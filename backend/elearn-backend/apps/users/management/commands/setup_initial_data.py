from django.core.management.base import BaseCommand
from apps.users.models import UserType
from utils.constants import UserTypeConstants

class Command(BaseCommand):
    help = 'Creates initial data for the application including User Types'

    def handle(self, *args, **options):
        self.stdout.write('Creating initial data...')
        
        user_types = UserTypeConstants.get_all_types()
        
        created_count = 0
        existing_count = 0
        
        for type_name in user_types:
            user_type, created = UserType.objects.get_or_create(
                name=type_name,
                defaults={'description': f'User type for {type_name}'}
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created UserType: {type_name}'))
                created_count += 1
            else:
                self.stdout.write(f'UserType already exists: {type_name}')
                existing_count += 1
                
        self.stdout.write(self.style.SUCCESS(
            f'Initial data setup complete. Created: {created_count}, Existing: {existing_count}'
        ))
