class UserTypeConstants:
    ADMIN = 'Admin'
    TEACHER = 'Teacher'
    STUDENT = 'Student'

    CHOICES = [
        (ADMIN, 'Admin'),
        (TEACHER, 'Teacher'),
        (STUDENT, 'Student'),
    ]

    @classmethod
    def get_all_types(cls):
        return [cls.ADMIN, cls.TEACHER, cls.STUDENT]

