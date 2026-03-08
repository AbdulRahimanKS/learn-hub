from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from apps.courses.models import (
    CourseClassSession, CoursePostSessionQuestion, CoursePostSessionChoice,
    BatchClassSession, BatchPostSessionQuestion, BatchPostSessionChoice
)
from apps.courses.serializers.course_module_serializers import (
    CoursePostSessionQuestionSerializer, BatchPostSessionQuestionSerializer
)
from utils.permissions import IsAdminOrTeacher
from django.db.models import F

class CoursePostSessionQuestionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrTeacher]
    serializer_class = CoursePostSessionQuestionSerializer

    def get_queryset(self):
        session_id = self.kwargs['session_id']
        return CoursePostSessionQuestion.objects.filter(course_session_id=session_id)

    def create(self, request, *args, **kwargs):
        session_id = self.kwargs['session_id']
        session = get_object_or_404(CourseClassSession, id=session_id)
        
        data = request.data
        order = int(data.get('order', 1))

        CoursePostSessionQuestion.objects.filter(
            course_session_id=session_id, order__gte=order
        ).update(order=F('order') + 1)

        question = CoursePostSessionQuestion.objects.create(
            course_session=session,
            text=data.get('text'),
            is_fill_in_the_blank=data.get('is_fill_in_the_blank', False),
            order=order
        )
        
        choices_data = data.get('choices', [])
        for choice in choices_data:
            CoursePostSessionChoice.objects.create(
                question=question,
                text=choice.get('text'),
                is_correct=choice.get('is_correct', False)
            )
            
        serializer = self.get_serializer(question)
        return Response({'success': True, 'data': serializer.data}, status=status.HTTP_201_CREATED)


class CoursePostSessionQuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrTeacher]
    serializer_class = CoursePostSessionQuestionSerializer
    queryset = CoursePostSessionQuestion.objects.all()
    lookup_field = 'id'
    lookup_url_kwarg = 'mcq_id'

    def update(self, request, *args, **kwargs):
        question = self.get_object()
        data = request.data
        
        new_order = int(data.get('order', question.order))
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
            question.choices.all().delete()
            for choice in data.get('choices', []):
                CoursePostSessionChoice.objects.create(
                    question=question,
                    text=choice.get('text'),
                    is_correct=choice.get('is_correct', False)
                )
                
        serializer = self.get_serializer(question)
        return Response({'success': True, 'data': serializer.data})

    def destroy(self, request, *args, **kwargs):
        question = self.get_object()
        session_id = question.course_session_id
        order = question.order
        
        super().destroy(request, *args, **kwargs)
        
        CoursePostSessionQuestion.objects.filter(
            course_session_id=session_id, order__gt=order
        ).update(order=F('order') - 1)
        
        return Response({'success': True, 'message': 'Deleted successfully'})


class BatchPostSessionQuestionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrTeacher]
    serializer_class = BatchPostSessionQuestionSerializer

    def get_queryset(self):
        session_id = self.kwargs['session_id']
        return BatchPostSessionQuestion.objects.filter(batch_session_id=session_id)

    def create(self, request, *args, **kwargs):
        session_id = self.kwargs['session_id']
        session = get_object_or_404(BatchClassSession, id=session_id)
        
        data = request.data
        order = int(data.get('order', 1))

        BatchPostSessionQuestion.objects.filter(
            batch_session_id=session_id, order__gte=order
        ).update(order=F('order') + 1)

        question = BatchPostSessionQuestion.objects.create(
            batch_session=session,
            text=data.get('text'),
            is_fill_in_the_blank=data.get('is_fill_in_the_blank', False),
            order=order
        )
        
        choices_data = data.get('choices', [])
        for choice in choices_data:
            BatchPostSessionChoice.objects.create(
                question=question,
                text=choice.get('text'),
                is_correct=choice.get('is_correct', False)
            )
            
        serializer = self.get_serializer(question)
        return Response({'success': True, 'data': serializer.data}, status=status.HTTP_201_CREATED)


class BatchPostSessionQuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrTeacher]
    serializer_class = BatchPostSessionQuestionSerializer
    queryset = BatchPostSessionQuestion.objects.all()
    lookup_field = 'id'
    lookup_url_kwarg = 'mcq_id'

    def update(self, request, *args, **kwargs):
        question = self.get_object()
        data = request.data
        
        new_order = int(data.get('order', question.order))
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
            question.choices.all().delete()
            for choice in data.get('choices', []):
                BatchPostSessionChoice.objects.create(
                    question=question,
                    text=choice.get('text'),
                    is_correct=choice.get('is_correct', False)
                )
                
        serializer = self.get_serializer(question)
        return Response({'success': True, 'data': serializer.data})

    def destroy(self, request, *args, **kwargs):
        question = self.get_object()
        session_id = question.batch_session_id
        order = question.order
        
        super().destroy(request, *args, **kwargs)
        
        BatchPostSessionQuestion.objects.filter(
            batch_session_id=session_id, order__gt=order
        ).update(order=F('order') - 1)
        
        return Response({'success': True, 'message': 'Deleted successfully'})
