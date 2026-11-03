/** Current general-graph verification; explicit legacy fixture argument retains contract-2 evidence. */
if(process.argv[2] && process.argv[2]!=='--general'){await import('./verify-codex-host-legacy.mjs');}
else{process.argv[2]='codex';await import('./verify-host-general.mjs');}
