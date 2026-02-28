class UserTypeConstants:
    SUPERADMIN = 'SuperAdmin'
    ADMIN = 'Admin'
    TEACHER = 'Teacher'
    STUDENT = 'Student'

    # UI-visible choices (SuperAdmin is intentionally excluded from the UI)
    CHOICES = [
        (ADMIN, 'Admin'),
        (TEACHER, 'Teacher'),
        (STUDENT, 'Student'),
    ]

    # All choices including SuperAdmin (used internally / backend only)
    ALL_CHOICES = [
        (SUPERADMIN, 'Super Admin'),
        (ADMIN, 'Admin'),
        (TEACHER, 'Teacher'),
        (STUDENT, 'Student'),
    ]

    @classmethod
    def get_all_types(cls):
        """Returns all user types including SuperAdmin (backend use only)."""
        return [cls.SUPERADMIN, cls.ADMIN, cls.TEACHER, cls.STUDENT]

    @classmethod
    def get_ui_types(cls):
        """Returns only the user types visible in the UI (excludes SuperAdmin)."""
        return [cls.ADMIN, cls.TEACHER, cls.STUDENT]
