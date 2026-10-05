process.env.HOST??="0.0.0.0";
process.argv[2]="start";
await import("./run-node.mjs");
