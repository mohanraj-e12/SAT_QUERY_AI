try:
    from datasets import load_dataset
except (ImportError, ModuleNotFoundError):
    load_dataset = None

print("Starting to load VRSBench dataset from Hugging Face...")
try:
    fw = load_dataset(
        "xiang709/VRSBench",
        name="default",
        split="train",
        streaming=True
    )

    print("SUCCESS: VRSBench loaded.")
    print("Dataset object:", fw)
    print("Features schema:", fw.features)

    print("Streaming first 3 samples:")
    for i, sample in enumerate(fw):
        print(f"\nSAMPLE {i}:")
        # Print a short representation of the sample (truncating long keys/images)
        clean_sample = {}
        for k, v in sample.items():
            if k == "image" or k == "img":
                clean_sample[k] = f"<PIL Image, format={getattr(v, 'format', None)}, size={getattr(v, 'size', None)}>"
            else:
                clean_sample[k] = v
        print(clean_sample)

        if i >= 2:
            break
except Exception as e:
    print("ERROR loading VRSBench:", str(e))
    import traceback
    traceback.print_exc()
