import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Native / ONNX packages must stay out of the server bundle.
  serverExternalPackages: ["@moss-dev/moss", "@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
