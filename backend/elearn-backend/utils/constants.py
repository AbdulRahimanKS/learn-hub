class UserTypeConstants:
    SUPER_ADMIN = 'Super Admin'
    ADMIN = 'Admin'
    TEACHER = 'Teacher'
    STUDENT = 'Student'

    CHOICES = [
        (SUPER_ADMIN, 'Super Admin'),
        (ADMIN, 'Admin'),
        (TEACHER, 'Teacher'),
        (STUDENT, 'Student'),
    ]

    @classmethod
    def get_all_types(cls):
        return [cls.SUPER_ADMIN, cls.ADMIN, cls.TEACHER, cls.STUDENT]

