from langchain.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

DATA_PATH = "/books"


# https://github.com/mlschmitt/classic-books-markdown/tree/main
def load_documents():
    loader = DirectoryLoader(DATA_PATH, glob="*.md")
    documents = loader.load()
    return documents


text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=500,
    length_function=len,
    add_start_index=True
)


def generate_data_store():
    documents = load_documents()
    chunks = text_splitter(documents)
