# Reflex needs a long-running Node process (the Moss session lives in memory) — deploy as a container
# on Render / Railway / Fly / any VM. Not suitable for serverless.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Fetch the embedding model (q8 MiniLM, ~23 MB) and build the 20k synthetic reflex library at build time.
ARG SYNTHETIC_N=20000
RUN mkdir -p .cache/models/Xenova/all-MiniLM-L6-v2/onnx data && cd .cache/models/Xenova/all-MiniLM-L6-v2 \
 && for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json onnx/model_quantized.onnx; do \
      node -e "fetch('https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/$f').then(r=>r.arrayBuffer()).then(b=>require('fs').writeFileSync('$f',Buffer.from(b)))"; done
RUN pnpm exec tsx scripts/seed-synthetic.ts $SYNTHETIC_N
RUN pnpm build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Required at runtime: MOSS_PROJECT_ID, MOSS_PROJECT_KEY, GROQ_API_KEY
CMD ["sh", "-c", "pnpm start -p ${PORT}"]
