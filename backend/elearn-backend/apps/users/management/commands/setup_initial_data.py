"""
Management command: setup_initial_data
--------------------------------------
Creates all UserType records and the initial Admin user credentials that are
handed to the client as their first login.

Usage:
    python manage.py setup_initial_data

The initial Admin user will be created with:
    Email    : admin@learnhub.com   (override via --admin-email)
    Password : Admin@1234           (override via --admin-password)
    Fullname : Admin                (override via --admin-fullname)

The SuperAdmin type is created in the database but is NOT surfaced in the UI.
"""
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.users.models import User, UserType
from utils.constants import UserTypeConstants


# Default initial-admin credentials
DEFAULT_ADMIN_EMAIL    = os.environ.get('INITIAL_ADMIN_EMAIL', 'admin@learnhub.com')
DEFAULT_ADMIN_PASSWORD = os.environ.get('INITIAL_ADMIN_PASSWORD', 'Admin@1234')
DEFAULT_ADMIN_FULLNAME = os.environ.get('INITIAL_ADMIN_FULLNAME', 'Admin')


class Command(BaseCommand):
    help = (
        'Creates initial data for the application: all UserTypes and '
        'the initial Admin user credentials for the client.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-email',
            default=DEFAULT_ADMIN_EMAIL,
            help='Email address for the initial Admin user.',
        )
        parser.add_argument(
            '--admin-password',
            default=DEFAULT_ADMIN_PASSWORD,
            help='Password for the initial Admin user.',
        )
        parser.add_argument(
            '--admin-fullname',
            default=DEFAULT_ADMIN_FULLNAME,
            help='Full name for the initial Admin user.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('=== Setting up initial data ==='))

        with transaction.atomic():
            self._create_user_types()
            self._create_initial_admin(
                email=options['admin_email'],
                password=options['admin_password'],
                fullname=options['admin_fullname'],
            )

        self.stdout.write(self.style.SUCCESS('=== Initial data setup complete ==='))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _create_user_types(self):
        self.stdout.write('\n[1] Creating UserTypes...')

        type_descriptions = {
            UserTypeConstants.SUPERADMIN: 'Super Administrator with full system access (backend only)',
            UserTypeConstants.ADMIN:      'Administrator who manages the platform for clients',
            UserTypeConstants.TEACHER:    'Instructor who creates and manages course content',
            UserTypeConstants.STUDENT:    'Learner who enrolls in and consumes courses',
        }

        created_count  = 0
        existing_count = 0

        for type_name in UserTypeConstants.get_all_types():
            _user_type, created = UserType.objects.get_or_create(
                name=type_name,
                defaults={'description': type_descriptions[type_name]},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'    ✔  Created  UserType: {type_name}'))
                created_count += 1
            else:
                self.stdout.write(f'    –  Exists  UserType: {type_name}')
                existing_count += 1

        self.stdout.write(
            f'    Created: {created_count}, Already existing: {existing_count}'
        )

    def _create_initial_admin(self, email: str, password: str, fullname: str):
        self.stdout.write('\n[2] Creating initial Admin user...')

        try:
            admin_type = UserType.objects.get(name=UserTypeConstants.ADMIN)
        except UserType.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                '    ✘  Admin UserType not found — make sure UserTypes were created first.'
            ))
            return

        if User.objects.filter(email=email.lower()).exists():
            self.stdout.write(
                f'    –  Admin user already exists: {email} (skipped)'
            )
            return

        user = User.objects.create_user(
            email=email,
            password=password,
            fullname=fullname,
            user_type=admin_type,
            is_staff=False,
            is_active=True,
            status=User.UserStatus.ACTIVE,
        )

        self.stdout.write(self.style.SUCCESS(
            f'\n    ✔  Initial Admin user created successfully!'
        ))
        self.stdout.write(self.style.WARNING(
            f'\n    ┌──────────────────────────────────────────┐\n'
            f'    │  INITIAL ADMIN CREDENTIALS (share with client) │\n'
            f'    ├──────────────────────────────────────────┤\n'
            f'    │  Email    : {email:<32}│\n'
            f'    │  Password : {password:<32}│\n'
            f'    │  Fullname : {fullname:<32}│\n'
            f'    └──────────────────────────────────────────┘\n'
        ))
        self.stdout.write(self.style.ERROR(
            '    ⚠  Please ask the client to change the password immediately after first login.\n'
        ))
