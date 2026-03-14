import logging
import json
import openai
import time
from django.conf import settings
from django.utils import timezone
from apps.courses.models import TestSubmission, TestSubmissionAnswer

# For PDF and Excel extraction
try:
    from pdfminer.high_level import extract_text as extract_pdf_text
except ImportError:
    extract_pdf_text = None

try:
    import pandas as pd
except ImportError:
    pd = None

logger = logging.getLogger(__name__)

class AIEvaluationService:
    """
    Service to handle AI-powered evaluation of student test submissions.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("OPENAI_API_KEY not found in settings. AI evaluation will be mocked.")

    def evaluate_submission(self, submission_id):
        """
        Evaluates a complete test submission.
        """
        try:
            submission = TestSubmission.objects.get(pk=submission_id)
        except TestSubmission.DoesNotExist:
            logger.error(f"Submission {submission_id} not found.")
            return

        answers = submission.answers.all()
        if not answers.exists():
            submission.status = TestSubmission.Status.PENDING_REVIEW
            submission.grader_remarks = "No answers submitted for evaluation."
            submission.save()
            return

        # Prepare the prompt
        test = submission.batch_weekly_test
        
        # Step 1: Read and extract Answer Key content
        answer_key_content = ""
        if test.answer_key:
            answer_key_content = self._extract_file_content(test.answer_key)
            
        prompt = self._prepare_prompt(test, answers, answer_key_content)

        if not self.client:
            # Mock evaluation if no API key
            self._mock_evaluation(submission)
            return

        try:
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are an expert technical instructor. Evaluate the student answers based on the provided questions and answer key. If a student provides both a text answer and a file, prioritize the text answer for detailed evaluation, but acknowledge that a supplementary file was uploaded. If only a file is provided without text, note that the file content is not yet directly readable by the AI and suggest the instructor review it manually. Provide a score and constructive feedback for each question in JSON format."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            self._process_ai_result(submission, result)

        except Exception as e:
            logger.error(f"AI evaluation failed for submission {submission_id}: {str(e)}")
            submission.status = TestSubmission.Status.PENDING_REVIEW
            submission.grader_remarks = f"AI Evaluation failed: {str(e)}. Please review manually."
            submission.save()

    def _prepare_prompt(self, test, answers, answer_key_content=""):
        """
        Constructs the prompt for OpenAI, including extracted content from files and the answer key.
        """
        prompt_data = {
            "test_title": test.title,
            "instructions": test.instructions,
            "answer_key_content": answer_key_content,
            "questions": []
        }

        for q in test.questions.all():
            answer = next((a for a in answers if a.question_id == q.id), None)
            
            # 1. Extract content from main question_file
            main_q_file_content = ""
            if q.question_file:
                main_q_file_content = self._extract_file_content(q.question_file)

            # 2. Extract content from extra question attachments
            q_attachments_content = []
            for attachment in q.attachments.all():
                att_content = self._extract_file_content(attachment.file)
                q_attachments_content.append({
                    "name": attachment.name or attachment.file.name,
                    "content": att_content
                })

            # 3. Extract content from student answer file
            extracted_answer_file_content = ""
            if answer and answer.answer_file:
                extracted_answer_file_content = self._extract_file_content(answer.answer_file)

            q_data = {
                "id": q.id,
                "text": q.text,
                "max_marks": q.marks,
                "main_question_file_content": main_q_file_content,
                "question_attachments": q_attachments_content,
                "student_answer_text": answer.answer_text if answer else "No answer provided",
                "extracted_answer_file_content": extracted_answer_file_content,
                "has_answer_file": bool(answer.answer_file) if answer else False,
                "file_name": answer.answer_file.name if answer and answer.answer_file else None
            }
            prompt_data["questions"].append(q_data)

        prompt = f"Please evaluate the following test submission. Use the provided 'answer_key_content' as the ground truth for correct solutions.\n\n"
        prompt += f"For each question, I have provided the question text, any question attachments (datasets, PDFs), student's text answer and any content extracted from their uploaded files:\n\n{json.dumps(prompt_data, indent=2)}\n\n"
        prompt += "Return a JSON object with scores (0 to max_marks) and feedback for each question under a 'evaluations' key mapping question IDs to results. "
        prompt += "In your feedback, explicitly mention if you evaluated the code/content from the uploaded file and how it matches the answer key and question context. "
        prompt += "Also provide an 'overall_feedback' and 'total_score'."
        
        return prompt

    def _extract_file_content(self, file_field):
        """
        Attempts to extract text content from various file types.
        Supported: .ipynb, .txt, .py, .js, .html, .css
        """
        if not file_field:
            return ""

        ext = file_field.name.split('.')[-1].lower()
        try:
            # Read file content
            content = file_field.read()
            # Reset file pointer for other uses if needed
            file_field.seek(0)
            
            if ext == 'ipynb':
                # Parse Jupyter Notebook
                notebook_data = json.loads(content.decode('utf-8'))
                extracted_text = []
                for cell in notebook_data.get('cells', []):
                    if cell.get('cell_type') in ['code', 'markdown']:
                        source = cell.get('source', [])
                        if isinstance(source, list):
                            extracted_text.append("".join(source))
                        else:
                            extracted_text.append(source)
                return "\n---\n".join(extracted_text)[:5000] # Limit to avoid token overflow
            
            elif ext in ['txt', 'py', 'js', 'html', 'css', 'md']:
                # Basic text files
                return content.decode('utf-8')[:5000]
            
            elif ext == 'pdf':
                if extract_pdf_text:
                    # Optional: handle large files better, but for now simple extract
                    return extract_pdf_text(file_field)[:5000]
                return "[PDF extraction libraries not installed on server]"
            
            elif ext in ['xlsx', 'xls', 'csv']:
                if pd:
                    if ext == 'csv':
                        df = pd.read_csv(file_field)
                    else:
                        df = pd.read_excel(file_field)
                    return df.to_string()[:5000]
                return "[Excel/CSV extraction libraries (pandas) not installed on server]"
            
            return f"[File type .{ext} is not directly readable by AI, please refer to the upload manually]"
        except Exception as e:
            logger.error(f"Error extracting content from {file_field.name}: {str(e)}")
            return f"[Error reading file content: {str(e)}]"

    def _process_ai_result(self, submission, result):
        """
        Parses the AI response and updates the database.
        """
        evaluations = result.get('evaluations', {})
        total_ai_score = 0
        
        for q_id_str, eval_data in evaluations.items():
            try:
                q_id = int(q_id_str)
                answer = submission.answers.filter(question_id=q_id).first()
                if answer:
                    answer.ai_score = eval_data.get('score', 0)
                    answer.ai_feedback = eval_data.get('feedback', '')
                    answer.save()
                    total_ai_score += answer.ai_score
            except (ValueError, TypeError):
                continue

        submission.ai_score = total_ai_score
        submission.ai_feedback = result.get('overall_feedback', '')
        submission.ai_response = result
        submission.ai_evaluated_at = timezone.now()
        
        # Initial suggested marks
        submission.marks_obtained = total_ai_score
        
        # Determine if passed based on pass_percentage
        test = submission.batch_weekly_test
        total_possible = sum(q.marks for q in test.questions.all())
        if total_possible > 0:
            obtained_pct = (total_ai_score / total_possible) * 100
            submission.is_passed = obtained_pct >= test.pass_percentage
        else:
            submission.is_passed = True

        submission.status = TestSubmission.Status.PENDING_REVIEW
        submission.save()

    def _mock_evaluation(self, submission):
        """
        Simulates AI evaluation for testing purposes.
        """
        import random
        time.sleep(2)  # Simulate delay
        
        total_score = 0
        for answer in submission.answers.all():
            answer.ai_score = random.uniform(0, answer.question.marks)
            answer.ai_feedback = "Good attempt. (Mock feedback)"
            answer.save()
            total_score += answer.ai_score

        submission.ai_score = total_score
        submission.ai_feedback = "Evaluation complete (Mocked)."
        submission.ai_evaluated_at = timezone.now()
        submission.marks_obtained = total_score
        
        test = submission.batch_weekly_test
        total_possible = sum(q.marks for q in test.questions.all())
        if total_possible > 0:
            obtained_pct = (total_score / total_possible) * 100
            submission.is_passed = obtained_pct >= test.pass_percentage
        else:
            submission.is_passed = True
            
        submission.status = TestSubmission.Status.PENDING_REVIEW
        submission.save()
