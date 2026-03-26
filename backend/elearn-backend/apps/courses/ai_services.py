import logging
import json
try:
    import openai
except ImportError:
    openai = None
import time
from django.conf import settings
from django.utils import timezone
from apps.courses.models import TestSubmission, TestSubmissionAnswer
from apps.users.models import AppConfiguration

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
        self.openai_key = getattr(settings, 'OPENAI_API_KEY', None)
        self.groq_key = getattr(settings, 'GROQ_API_KEY', None)
        self.groq_base_url = getattr(settings, 'GROQ_BASE_URL', 'https://api.groq.com/openai/v1')
        self.allow_mock = bool(getattr(settings, 'AI_ALLOW_MOCK_EVALUATION', False))
        self.openai_model = "gpt-4o-mini"
        self.groq_model = "llama-3.3-70b-versatile"
        
        try:
            app_config = AppConfiguration.objects.first()
            if app_config:
                if app_config.openai_api_key:
                    self.openai_key = app_config.openai_api_key
                if app_config.groq_api_key:
                    self.groq_key = app_config.groq_api_key
                if app_config.openai_model:
                    self.openai_model = app_config.openai_model
                if app_config.groq_model:
                    self.groq_model = app_config.groq_model
        except Exception as e:
            logger.warning(f"Could not load AppConfiguration for AI configs: {e}")
            
        self.client = None
        self.provider = None
        self.model = self.openai_model

        if self.groq_key and openai:
            try:
                self.client = openai.OpenAI(
                    api_key=self.groq_key,
                    base_url=self.groq_base_url
                )
                self.provider = "groq"
                self.model = self.groq_model
                logger.info(f"Using Groq for AI evaluation with model {self.model}.")
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")

        if not self.client and self.openai_key and openai:
            self.client = openai.OpenAI(api_key=self.openai_key)
            self.provider = "openai"
            self.model = self.openai_model
            logger.info(f"Using OpenAI for AI evaluation with model {self.model}.")

        if not self.client:
            if not openai:
                if self.allow_mock:
                    logger.warning("openai library not installed. AI evaluation will be mocked.")
                else:
                    logger.error("openai library not installed and AI mock mode is disabled.")
            else:
                if self.allow_mock:
                    logger.warning("No AI API keys (OpenAI/Groq) found. AI evaluation will be mocked.")
                else:
                    logger.error("No AI API keys (OpenAI/Groq) found and AI mock mode is disabled.")

    def evaluate_submission(self, submission_id):
        """
        Evaluates a complete test submission.
        """
        try:
            submission = TestSubmission.objects.get(pk=submission_id)
        except TestSubmission.DoesNotExist:
            logger.error(f"Submission {submission_id} not found.")
            return

        submission.ai_job_status = TestSubmission.AIJobStatus.RUNNING
        submission.ai_error_message = ""
        submission.save(update_fields=['ai_job_status', 'ai_error_message'])

        answers = submission.answers.all()
        if not answers.exists():
            submission.status = TestSubmission.Status.PENDING_REVIEW
            submission.ai_job_status = TestSubmission.AIJobStatus.FAILED
            submission.ai_error_message = "No answers submitted for evaluation."
            submission.save(update_fields=['status', 'ai_job_status', 'ai_error_message'])
            return

        test = submission.batch_weekly_test
        
        answer_key_content = ""
        if test.answer_key:
            answer_key_content = self._extract_file_content(test.answer_key)
            
        prompt = self._prepare_prompt(test, answers, answer_key_content)

        if not self.client:
            if self.allow_mock:
                self._mock_evaluation(submission)
                return
            raise RuntimeError("AI provider is not configured. Set OpenAI/Groq keys or enable AI_ALLOW_MOCK_EVALUATION.")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
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
            # If it fails, move to PENDING_REVIEW but with clear error so they can retry
            submission.status = TestSubmission.Status.PENDING_REVIEW
            submission.ai_feedback = f"AI Evaluation Error: {str(e)}"
            submission.ai_job_status = TestSubmission.AIJobStatus.FAILED
            submission.ai_error_message = str(e)
            submission.save(update_fields=['status', 'ai_feedback', 'ai_job_status', 'ai_error_message'])

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
                    import io
                    # Use a BytesIO object to avoid "Unsupported input type" errors with FieldFile
                    pdf_io = io.BytesIO(content)
                    return extract_pdf_text(pdf_io)[:5000]
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
                    answer.ai_response = eval_data
                    answer.save()
                    total_ai_score += answer.ai_score
            except (ValueError, TypeError):
                continue

        submission.ai_score = total_ai_score
        submission.ai_feedback = result.get('overall_feedback', '')
        # Pre-fill instructor remarks from AI so reviewers can edit before publishing.
        submission.grader_remarks = submission.ai_feedback or ""
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
        submission.ai_job_status = TestSubmission.AIJobStatus.SUCCEEDED
        submission.ai_error_message = ""
        submission.save(update_fields=[
            'ai_score', 'ai_feedback', 'ai_response', 'ai_evaluated_at',
            'grader_remarks', 'marks_obtained', 'is_passed', 'status', 'ai_job_status', 'ai_error_message'
        ])

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
        submission.grader_remarks = submission.ai_feedback
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
        submission.ai_job_status = TestSubmission.AIJobStatus.SUCCEEDED
        submission.ai_error_message = ""
        submission.save(update_fields=[
            'ai_score', 'ai_feedback', 'ai_evaluated_at',
            'grader_remarks', 'marks_obtained', 'is_passed', 'status', 'ai_job_status', 'ai_error_message'
        ])

    def evaluate_single_answer(self, answer_id):
        """
        Evaluates a single question answer.
        Uses the same material as full submission evaluation: answer key, test instructions,
        question file, question reference attachments, student text, and extracted answer file.
        """
        try:
            answer = (
                TestSubmissionAnswer.objects.select_related(
                    'submission',
                    'submission__batch_weekly_test',
                    'question',
                )
                .prefetch_related('question__attachments')
                .get(pk=answer_id)
            )
        except TestSubmissionAnswer.DoesNotExist:
            logger.error(f"Answer {answer_id} not found.")
            return {"ok": False, "error": "Answer not found."}

        submission = answer.submission
        if not submission:
            logger.error(f"Submission for answer {answer_id} not found.")
            return {"ok": False, "error": "Submission not found for this answer."}
        test = submission.batch_weekly_test
        if not test:
            logger.error(f"Batch weekly test for submission {submission.id} not found.")
            return {"ok": False, "error": "Batch weekly test not found for this submission."}
        q = answer.question

        answer_key_content = ""
        if test.answer_key:
            answer_key_content = self._extract_file_content(test.answer_key)

        main_q_file_content = ""
        if q.question_file:
            main_q_file_content = self._extract_file_content(q.question_file)

        q_attachments_content = []
        for attachment in q.attachments.all():
            att_content = self._extract_file_content(attachment.file)
            q_attachments_content.append({
                "name": attachment.name or getattr(attachment.file, "name", "") or "attachment",
                "content": att_content,
            })

        extracted_answer_file_content = ""
        if answer.answer_file:
            extracted_answer_file_content = self._extract_file_content(answer.answer_file)

        instructions = (test.instructions or "").strip() or "(none provided)"

        question_payload = {
            "id": q.id,
            "text": q.text,
            "max_marks": q.marks,
            "main_question_file_content": main_q_file_content or "(none — no main question file)",
            "question_attachments": q_attachments_content,
            "student_answer_text": answer.answer_text if answer.answer_text else "(no text answer)",
            "extracted_answer_file_content": extracted_answer_file_content or "(none — no file or empty extraction)",
            "has_answer_file": bool(answer.answer_file),
            "file_name": answer.answer_file.name if answer.answer_file else None,
        }

        prompt = (
            "Evaluate this single student answer for one question in a batch weekly test.\n"
            "Use 'answer_key_content' as the ground truth for correct solutions where applicable.\n\n"
            f"Test title: {test.title}\n"
            f"Test instructions: {instructions}\n\n"
            "The JSON block uses the same shape as full-submission evaluation for one question:\n"
            "- main_question_file_content: optional text extracted from the question's primary file.\n"
            "- question_attachments: optional reference files (datasets, PDFs, etc.); if this list is non-empty, "
            "use them when judging the answer.\n"
            "- student_answer_text and extracted_answer_file_content: the student's response; if has_answer_file is "
            "true but extraction is empty or a placeholder, say so in your feedback (instructor may need to open the file).\n\n"
            f"{json.dumps({'answer_key_content': answer_key_content, 'question': question_payload}, indent=2)}\n\n"
            f"TASK:\n"
            f"Return a JSON object with keys 'score' (number from 0 to {q.marks}) and 'feedback' (concise).\n"
            "In feedback, explicitly note whether you relied on question attachments and/or the student's uploaded file content, "
            "and how the answer aligns with the answer key and question context."
        )

        if not self.client:
            if self.allow_mock:
                import random
                answer.ai_score = random.uniform(0, q.marks)
                answer.ai_feedback = "Mocked single question feedback."
                answer.save()
                return {"ok": True}
            return {"ok": False, "error": "AI provider is not configured for single-answer evaluation."}

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a technical instructor grader. Evaluate using the question text, optional question "
                            "file and reference attachments, the answer key, and the student's text and any extracted "
                            "file content. If reference attachments are present, incorporate them. If the student "
                            "uploaded a file but content could not be read, state that clearly."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            result = json.loads(response.choices[0].message.content)
            answer.ai_score = result.get('score', 0)
            answer.ai_feedback = result.get('feedback', '')
            answer.ai_response = result
            answer.save()
            return {"ok": True}
        except Exception as e:
            logger.error(f"Single answer AI evaluation failed: {str(e)}")
            return {"ok": False, "error": str(e)}
