import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();
app.listen(config.port, () => {
  console.log(`sep38-conformance-backend listening on :${config.port}`);
});
