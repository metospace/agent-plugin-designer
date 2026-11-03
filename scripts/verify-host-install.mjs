/** Current UI-exported installation verification; explicit fixture directory preserves legacy check. */
if(process.argv[2] && process.argv[2]!== '--general'){await import('./verify-host-install-legacy.mjs');}
else{await import('./verify-host-install-general.mjs');}
