export async function compileErgoTree(contract, symbols) {
    const exec = require('child_process').exec;
    const childProcess = exec('java -cp C:\\Users\\thier\\Ergo\\ErgoScriptCompiler\\target\\scala-2.12\\ErgoScriptCompiler-assembly-0.1.jar Compile '+contract+' '+symbols, function(err, stdout, stderr) {
        if (err) {
            console.log(err)
        }
        console.log(stdout)
        return stdout;
    });
    return childProcess;
}