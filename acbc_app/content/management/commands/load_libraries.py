import os
from django.core.files import File as DjangoFile
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from content.models import File, Library


class Command(BaseCommand):
    help = 'Populates the database with file entries from two directories and assigns them to different libraries'

    def handle(self, *args, **options):
        base_dir = os.path.dirname(__file__)  # Get the directory of the current script
        proxy_user = User.objects.last()
        # Define the directories and their corresponding libraries
        directories = {
            'classic_books_artists': 'Library for Artists',
            'classic_books_philosophers': 'Library for Philosophers'
        }

        # Process each directory and its corresponding library
        for subdir, library_name in directories.items():
            directory_path = os.path.join(base_dir, subdir)
            library, created = Library.objects.get_or_create(name=library_name, user=proxy_user)

            self.stdout.write(self.style.SUCCESS(f'Processing files in {subdir} for library: {library.name}'))

            # Traverse subdirectories for each author
            for author_dir in os.listdir(directory_path):
                author_path = os.path.join(directory_path, author_dir)
                if os.path.isdir(author_path):  # Ensure it's a directory
                    self.stdout.write(self.style.SUCCESS(f'Processing books for author: {author_dir}'))

                    # Process each file in the author's directory
                    for filename in os.listdir(author_path):
                        if filename.endswith('.pdf') or filename.endswith('.md'):
                            filepath = os.path.join(author_path, filename)
                            with open(filepath, 'rb') as file:
                                django_file = DjangoFile(file, name=filename)
                                # Create a new File instance for each file
                                file_instance = File(
                                    library=library,
                                    file=django_file,
                                    title=os.path.splitext(filename)[0],
                                    author=author_dir,  # Set author name from directory name
                                    extension=os.path.splitext(filename)[1],
                                    file_size=os.path.getsize(filepath)
                                )
                                file_instance.save()
                                self.stdout.write(self.style.SUCCESS(f'Successfully saved file {filename} by author {author_dir} in library {library.name}'))

            self.stdout.write(self.style.SUCCESS(f'All files processed for library: {library.name}'))
