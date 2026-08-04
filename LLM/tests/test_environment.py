from llm.main import environment_report


def test_environment_report_lists_toolchain():
    report = environment_report()

    assert report["torch"]
    assert report["langchain"]
    assert report["device"] in {"cpu", "cuda", "mps"}


def test_torch_matmul():
    import torch

    result = torch.rand(2, 3) @ torch.rand(3, 4)

    assert tuple(result.shape) == (2, 4)
