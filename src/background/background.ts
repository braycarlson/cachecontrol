import { engineSelect, start, watch } from "../engine";

const engine = engineSelect();

watch(engine);
start(engine);
