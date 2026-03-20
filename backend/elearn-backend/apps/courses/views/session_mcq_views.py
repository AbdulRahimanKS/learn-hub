from rest_framework import status
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from apps.courses.models import (
    CourseClassSession, CoursePostSessionQuestion, CoursePostSessionChoice,
    BatchClassSession, BatchPostSessionQuestion, BatchPostSessionChoice
)
from apps.courses.serializers.course_module_serializers import (
    CoursePostSessionQuestionSerializer, BatchPostSessionQuestionSerializer
)
from utils.permissions import IsSuperAdminAdminOrTeacher
from django.db.models import F
from utils.common import ServiceError, format_success_response
import logging

logger = logging.getLogger(__name__)


def _validate_post_session_choices(choices_data, is_fill_in_the_blank):
    valid_choices = [c for c in (choices_data or []) if str(c.get('text', '')).strip()]
    if is_fill_in_the_blank:
        if len(valid_choices) < 1:
            raise ServiceError(
                detail="Provide at least one acceptable answer for fill-in-the-blank questions.",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        return

    if len(valid_choices) < 2:
        raise ServiceError(
            detail="Provide at least two options for MCQ questions.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    correct_count = sum(1 for c in valid_choices if c.get('is_correct', False))
    if correct_count != 1:
        raise ServiceError(
            detail="Exactly one option must be marked as correct for MCQ questions.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

def _order_out_of_range_message(max_allowed):
    if max_allowed == 1:
        return "Only Question 1 exists. Create more questions before moving to a higher order."
    return f"Question order must be between 1 and {max_allowed}."


@extend_schema(tags=["Session MCQs"])
class CoursePostSessionQuestionListCreateView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = CoursePostSessionQuestionSerializer

    def get_queryset(self):
        session_id = self.kwargs['session_id']
        return CoursePostSessionQuestion.objects.filter(course_session_id=session_id)

    @extend_schema(
        summary="List course post session questions",
        responses={200: CoursePostSessionQuestionSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        questions = self.get_queryset().order_by('order', 'id')
        serializer = self.serializer_class(questions, many=True)
        return format_success_response(
            message="Course post session questions retrieved successfully",
            data=serializer.data,
            status_code=status.HTTP_200_OK
        )

    @extend_schema(
        summary="Create a new course post session question",
        request=CoursePostSessionQuestionSerializer,
        responses={201: CoursePostSessionQuestionSerializer}
    )
    def post(self, request, *args, **kwargs):
        try:
            session_id = self.kwargs['session_id']
            try:
                session = CourseClassSession.objects.get(id=session_id)
            except CourseClassSession.DoesNotExist:
                raise ServiceError(detail="Course class session not found.", status_code=status.HTTP_404_NOT_FOUND)
            
            data = request.data
            order = int(data.get('order', 1))
            is_fill_in_the_blank = data.get('is_fill_in_the_blank', False)
            choices_data = data.get('choices', [])
            _validate_post_session_choices(choices_data, is_fill_in_the_blank)
            max_allowed = CoursePostSessionQuestion.objects.filter(course_session_id=session_id).count() + 1
            if order < 1 or order > max_allowed:
                raise ServiceError(
                    detail=_order_out_of_range_message(max_allowed),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            CoursePostSessionQuestion.objects.filter(
                course_session_id=session_id, order__gte=order
            ).update(order=F('order') + 1)

            question = CoursePostSessionQuestion.objects.create(
                course_session=session,
                text=data.get('text'),
                is_fill_in_the_blank=is_fill_in_the_blank,
                order=order
            )
            
            for choice in choices_data:
                CoursePostSessionChoice.objects.create(
                    question=question,
                    text=choice.get('text'),
                    is_correct=choice.get('is_correct', False)
                )
                
            return format_success_response(
                message="Course post session question created successfully",
                data=None,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating course post session question: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the course post session question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Session MCQs"])
class CoursePostSessionQuestionDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = CoursePostSessionQuestionSerializer
    queryset = CoursePostSessionQuestion.objects.all()
    lookup_field = 'id'
    lookup_url_kwarg = 'mcq_id'

    def get_object(self):
        return get_object_or_404(CoursePostSessionQuestion, id=self.kwargs['mcq_id'])

    @extend_schema(
        summary="Update a course post session question",
        request=CoursePostSessionQuestionSerializer,
        responses={200: CoursePostSessionQuestionSerializer}
    )
    def patch(self, request, *args, **kwargs):
        try:
            question = self.get_object()
            data = request.data
            
            new_order = int(data.get('order', question.order))
            total_questions = CoursePostSessionQuestion.objects.filter(course_session_id=question.course_session_id).count()
            if new_order < 1 or new_order > total_questions:
                raise ServiceError(
                    detail=_order_out_of_range_message(total_questions),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            if new_order != question.order:
                if new_order < question.order:
                    CoursePostSessionQuestion.objects.filter(
                        course_session_id=question.course_session_id,
                        order__gte=new_order,
                        order__lt=question.order
                    ).update(order=F('order') + 1)
                else:
                    CoursePostSessionQuestion.objects.filter(
                        course_session_id=question.course_session_id,
                        order__gt=question.order,
                        order__lte=new_order
                    ).update(order=F('order') - 1)

            question.text = data.get('text', question.text)
            question.is_fill_in_the_blank = data.get('is_fill_in_the_blank', question.is_fill_in_the_blank)
            question.order = new_order
            question.save()
            
            if 'choices' in data:
                _validate_post_session_choices(data.get('choices', []), question.is_fill_in_the_blank)
                question.choices.all().delete()
                for choice in data.get('choices', []):
                    CoursePostSessionChoice.objects.create(
                        question=question,
                        text=choice.get('text'),
                        is_correct=choice.get('is_correct', False)
                    )
                    
            return format_success_response(
                message="Course post session question updated successfully",
                data=None,
                status_code=status.HTTP_200_OK
                )
        except ServiceError:
            raise   
        except Exception as e:
            logger.error(f"Error updating course post session question: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the course post session question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a course post session question", responses={200: None})
    def delete(self, request, *args, **kwargs):
        try:
            question = self.get_object()
            session_id = question.course_session_id
            order = question.order
            
            question.delete()
            
            CoursePostSessionQuestion.objects.filter(
                course_session_id=session_id, order__gt=order
            ).update(order=F('order') - 1)
            
            return format_success_response(
                message="Course post session question deleted successfully",
                data=None,
                status_code=status.HTTP_200_OK
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting course post session question: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the course post session question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Session MCQs"])
class BatchPostSessionQuestionListCreateView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = BatchPostSessionQuestionSerializer

    def get_queryset(self):
        session_id = self.kwargs['session_id']
        return BatchPostSessionQuestion.objects.filter(batch_session_id=session_id)

    @extend_schema(
        summary="List batch post session questions",
        responses={200: BatchPostSessionQuestionSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        questions = self.get_queryset().order_by('order', 'id')
        serializer = self.serializer_class(questions, many=True)
        return format_success_response(
            message="Batch post session questions retrieved successfully",
            data=serializer.data,
            status_code=status.HTTP_200_OK
        )

    @extend_schema(
        summary="Create a new batch post session question",
        request=BatchPostSessionQuestionSerializer,
        responses={201: BatchPostSessionQuestionSerializer}
    )
    def post(self, request, *args, **kwargs):
        try:
            session_id = self.kwargs['session_id']
            session = get_object_or_404(BatchClassSession, id=session_id)
            
            data = request.data
            order = int(data.get('order', 1))
            is_fill_in_the_blank = data.get('is_fill_in_the_blank', False)
            choices_data = data.get('choices', [])
            _validate_post_session_choices(choices_data, is_fill_in_the_blank)
            max_allowed = BatchPostSessionQuestion.objects.filter(batch_session_id=session_id).count() + 1
            if order < 1 or order > max_allowed:
                raise ServiceError(
                    detail=_order_out_of_range_message(max_allowed),
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            BatchPostSessionQuestion.objects.filter(
                batch_session_id=session_id, order__gte=order
            ).update(order=F('order') + 1)

            question = BatchPostSessionQuestion.objects.create(
                batch_session=session,
                text=data.get('text'),
                is_fill_in_the_blank=is_fill_in_the_blank,
                order=order
            )
            
            for choice in choices_data:
                BatchPostSessionChoice.objects.create(
                    question=question,
                    text=choice.get('text'),
                    is_correct=choice.get('is_correct', False)
                )
                
            return format_success_response(
                message="Batch post session question created successfully",
                data=None,
                status_code=status.HTTP_201_CREATED
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error creating batch post session question: {str(e)}")
            raise ServiceError(detail="An error occurred while creating the batch post session question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(tags=["Session MCQs"])
class BatchPostSessionQuestionDetailView(APIView):
    permission_classes = [IsSuperAdminAdminOrTeacher]
    serializer_class = BatchPostSessionQuestionSerializer
    queryset = BatchPostSessionQuestion.objects.all()
    lookup_field = 'id'
    lookup_url_kwarg = 'mcq_id'

    def get_object(self):
        return get_object_or_404(BatchPostSessionQuestion, id=self.kwargs['mcq_id'])

    @extend_schema(
        summary="Update a batch post session question",
        request=BatchPostSessionQuestionSerializer,
        responses={200: BatchPostSessionQuestionSerializer}
    )
    def patch(self, request, *args, **kwargs):
        try:
            question = self.get_object()
            data = request.data
            
            new_order = int(data.get('order', question.order))
            total_questions = BatchPostSessionQuestion.objects.filter(batch_session_id=question.batch_session_id).count()
            if new_order < 1 or new_order > total_questions:
                raise ServiceError(
                    detail=_order_out_of_range_message(total_questions),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            if new_order != question.order:
                if new_order < question.order:
                    BatchPostSessionQuestion.objects.filter(
                        batch_session_id=question.batch_session_id,
                        order__gte=new_order,
                        order__lt=question.order
                    ).update(order=F('order') + 1)
                else:
                    BatchPostSessionQuestion.objects.filter(
                        batch_session_id=question.batch_session_id,
                        order__gt=question.order,
                        order__lte=new_order
                    ).update(order=F('order') - 1)

            question.text = data.get('text', question.text)
            question.is_fill_in_the_blank = data.get('is_fill_in_the_blank', question.is_fill_in_the_blank)
            question.order = new_order
            question.save()
            
            if 'choices' in data:
                _validate_post_session_choices(data.get('choices', []), question.is_fill_in_the_blank)
                question.choices.all().delete()
                for choice in data.get('choices', []):
                    BatchPostSessionChoice.objects.create(
                        question=question,
                        text=choice.get('text'),
                        is_correct=choice.get('is_correct', False)
                    )
                    
            return format_success_response(
                message="Batch post session question updated successfully",
                    data=None,
                    status_code=status.HTTP_200_OK
                )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error updating batch post session question: {str(e)}")
            raise ServiceError(detail="An error occurred while updating the batch post session question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(summary="Delete a batch post session question", responses={200: None})
    def delete(self, request, *args, **kwargs):
        try:
            question = self.get_object()
            session_id = question.batch_session_id
            order = question.order
            
            question.delete()
            
            BatchPostSessionQuestion.objects.filter(
                    batch_session_id=session_id, order__gt=order
                ).update(order=F('order') - 1)
                
            BatchPostSessionQuestion.objects.filter(
                batch_session_id=session_id, order__gt=order
            ).update(order=F('order') - 1)
            
            return format_success_response(
                message="Batch post session question deleted successfully",
                data=None,
                status_code=status.HTTP_200_OK
            )
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Error deleting batch post session question: {str(e)}")
            raise ServiceError(detail="An error occurred while deleting the batch post session question.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
