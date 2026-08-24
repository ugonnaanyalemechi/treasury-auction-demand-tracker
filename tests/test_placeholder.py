from pipeline import __version__


def test_pipeline_package_is_importable() -> None:
    assert __version__ == "0.1.0"
