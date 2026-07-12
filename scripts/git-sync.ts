import { spawn } from "child_process";

const args = process.argv.slice(2);
const message = args[0] || "Update from developer portal";

function runCmd(command: string, cmdArgs: string[]): Promise<number> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    console.log(`\n> Running: ${command} ${cmdArgs.join(" ")}`);
    const child = spawn(command, cmdArgs, {
      shell: isWindows,
      stdio: "inherit"
    });
    child.on("close", (code) => {
      resolve(code || 0);
    });
  });
}

async function main() {
  console.log("Staging all changes...");
  let code = await runCmd("git", ["add", "."]);
  if (code !== 0) process.exit(code);

  console.log(`Committing with message: "${message}"...`);
  code = await runCmd("git", ["commit", "-m", message]);
  // Git commit exits with 1 if there's nothing to commit. We check the status or proceed anyway
  
  console.log("Pushing commits to remote repository...");
  code = await runCmd("git", ["push"]);
  process.exit(code);
}

main();
