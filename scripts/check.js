const {execFileSync}=require('node:child_process');
const {readdirSync}=require('node:fs');
for(const file of ['server.js',...readdirSync('public').filter(f=>/\.m?js$/.test(f)).map(f=>'public/'+f)])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log('All source JavaScript parses.');
