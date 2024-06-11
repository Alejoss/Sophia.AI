# Sophia.AI
A descentralized, blockchain-backed library that uses AI to interact with and to certify documents.


**Installation**

docker-compose up --build

*Important, don't forget to run migrations:*

docker-compose exec backend python manage.py migrate

*Optionally create a superuser:*

docker-compose exec backend python manage.py create_admin

*Load fixtures*

docker-compose exec backend python manage.py load_fixtures

*Load the libraries database with initial test data*

docker-compose exec backend python manage.py load_libraries
