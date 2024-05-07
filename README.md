# Sophia.AI
A descentralized, blockchain-backed library that uses AI to interact with and to certify documents.


**Installation**

docker-compose up --build

*Important, don't forget to run migrations:*

docker-compose exec backend python manage.py migrate

*Optionally create a superuser:*

docker exec acbc_backend python manage.py create_admin
