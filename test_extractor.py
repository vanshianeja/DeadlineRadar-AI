from engines.extractor import extract_deadlines

if __name__ == "__main__":

    message = """
    Guys DBMS assignment 30 November 2026 tak
    submit karna hai.

    DSA viva kal hai.

    MPCA report shayad Monday tak submit karni hai,
    but sir ne abhi confirm nahi kiya.

    SML project submission 2 December 2026 ko hai.

    Btw koi mess ja raha hai kya?
    """

    result = extract_deadlines(message)

    print(result.model_dump_json(indent=4))