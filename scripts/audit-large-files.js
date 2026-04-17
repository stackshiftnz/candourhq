const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                const lines = fs.readFileSync(file, 'utf-8').split('\n').length;
                if (lines > 300) {
                    console.log(`LARGE FILE: ${file} - ${lines} lines`);
                }
            }
        }
    });
    return results;
}

walk(path.join(process.cwd(), 'app'));
walk(path.join(process.cwd(), 'components'));
