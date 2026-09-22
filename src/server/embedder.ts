// Local sentence embedder: Xenova/all-MiniLM-L6-v2 (384-d, mean pooled, normalized).
import fs from "node:fs";
import path from "node:path";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const DIM = 384;

type Extractor = (text: string | string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

const g = globalThis as unknown as { __reflexEmbedder?: Promise<Extractor> };

function getExtractor(): Promise<Extractor> {
  if (!g.__reflexEmbedder) {
    g.__reflexEmbedder = (async () => {
      const tf = await import("@huggingface/transformers");
      const cacheDir = path.join(process.cwd(), ".cache", "models");
      tf.env.cacheDir = cacheDir;
      // Pre-downloaded quantized model → load from disk only (network is unreliable); else fetch remotely.
      const local = fs.existsSync(path.join(cacheDir, EMBED_MODEL, "onnx", "model_quantized.onnx"));
      if (local) {
        tf.env.localModelPath = cacheDir;
        tf.env.allowLocalModels = true;
        tf.env.allowRemoteModels = false;
      }
      const pipe = await tf.pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });
      return pipe as unknown as Extractor;
    })().catch((e) => {
      g.__reflexEmbedder = undefined;
      throw e;
    });
  }
  return g.__reflexEmbedder;
}

export async function warm(): Promise<void> {
  await embed("warm up");
}

export async function embed(text: string): Promise<{ vec: number[]; ms: number }> {
  const ex = await getExtractor();
  const t0 = performance.now();
  const out = await ex(text, { pooling: "mean", normalize: true });
  return { vec: Array.from(out.data), ms: performance.now() - t0 };
}

/** Batch embed (for seeding). Returns one Float32Array of length texts.length * DIM. */
export async function embedBatch(texts: string[]): Promise<Float32Array> {
  const ex = await getExtractor();
  const out = await ex(texts, { pooling: "mean", normalize: true });
  return out.data;
}
