from pathlib import Path
from engines.extractor import extract_deadlines_from_image

if __name__ == "__main__":

    image_path = Path("data/sample_notice.png")

    image_bytes = image_path.read_bytes()

    result = extract_deadlines_from_image(
        image_bytes,
        mime_type="image/png"
    )

    print(result.model_dump_json(indent=4))