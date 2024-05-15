import argparse
from dataclasses import dataclass
from langchain.prompts import ChatPromptTemplate
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

from langchain_community.chat_models import ChatOpenAI

# Directly specifying the OpenAI API key

open_ai_api_key = ""

CHROMA_PATH = "chroma"

PROMPT_TEMPLATE = """
Answer the question based only on the following context:

{context}

---

Answer the question based on the above context: {question}
"""


def main():
    # Get query text from the console.
    query_text = input("Please enter your query: ")
    print(f"Query text: {query_text}")

    # Prepare the DB.
    print("Initializing embedding function and database...")
    embedding_function = OpenAIEmbeddings(api_key=open_ai_api_key)
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_function)
    print("Database initialized.")

    # Check if the database has documents.
    print("Checking database documents...")
    all_docs = db.get()
    print(f"All documents in the database: {all_docs}")
    if len(all_docs) == 0:
        print("The database is empty. Please ensure it is populated with documents.")
        return

    # Search the DB.
    print("Searching the database...")
    results = db.similarity_search_with_relevance_scores(query_text, k=3)
    print(f"Search results: {results}")
    if len(results) == 0 or results[0][1] < 0.7:
        print("Unable to find matching results.")
        return

    context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])
    print(f"Context text: {context_text}")
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    prompt = prompt_template.format(context=context_text, question=query_text)
    print(f"Prompt: {prompt}")

    model = ChatOpenAI(api_key=open_ai_api_key)
    response_text = model.predict(prompt)
    print(f"Response text: {response_text}")

    sources = [doc.metadata.get("source", None) for doc, _score in results]
    formatted_response = f"Response: {response_text}\nSources: {sources}"
    print(formatted_response)


if __name__ == "__main__":
    main()
