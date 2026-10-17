using System;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace NetLabPusher
{
    class Program
    {
        private const string TargetRepoUrl = "https://github.com/Rishkek/PES_SEC3GCSE_CNPROJ_X";
        private const string TargetRepoGit = "https://github.com/Rishkek/PES_SEC3GCSE_CNPROJ_X.git";
        private const string TargetBranch = "main";

        static void Main(string[] args)
        {
            Console.Title = "NetLab — Git & GitHub Repository Publisher (push.exe)";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"
========================================================================
    _   _      _   _          _     
   | \ | | ___| |_| |    __ _| |__  
   |  \| |/ _ \ __| |   / _` | '_ \ 
   | |\  |  __/ |_| |__| (_| | |_) |
   |_| \_|\___|\__|_____\__,_|_.__/ 
   Congestion Detection & Traffic Rerouting Lab
   Git & GitHub Remote Publisher (push.exe)
========================================================================");
            Console.ResetColor();

            string rootDir = LocateProjectRoot();
            Console.WriteLine("[*] Project Root: " + rootDir);
            Console.WriteLine("[*] Target Repo : " + TargetRepoUrl);
            Console.WriteLine("[*] Branch      : " + TargetBranch);

            // Step 1: Verify Git & GitHub CLI
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 1/5] Verifying Git and GitHub CLI...");
            Console.ResetColor();

            string gitVer;
            if (!TestExecutable("git", "--version", out gitVer))
            {
                PrintError("Git is not found in PATH or installed on this system.");
                Console.WriteLine("Please install Git from https://git-scm.com/downloads and try again.");
                ExitPrompt(1);
                return;
            }
            PrintSuccess("Found Git: " + gitVer.Trim());

            string ghVer;
            bool hasGh = TestExecutable("gh", "--version", out ghVer);
            if (hasGh)
            {
                PrintSuccess("Found GitHub CLI: " + ghVer.Split('\n')[0].Trim());
                string authOut;
                if (TestExecutable("gh", "auth status", out authOut))
                {
                    PrintSuccess("GitHub CLI is authenticated.");
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("[!] GitHub CLI is installed but may require authentication (gh auth login).");
                    Console.ResetColor();
                }
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[!] GitHub CLI (gh) not detected in PATH; proceeding with native Git.");
                Console.ResetColor();
            }

            // Step 2: Ensure Remote Origin is configured
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 2/5] Checking Git repository remotes...");
            Console.ResetColor();

            EnsureGitRemote(rootDir);

            // Step 3: Inspect local working tree status
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 3/5] Inspecting repository status...");
            Console.ResetColor();

            string statusOutput = RunProcessWithOutput("git", "status --short", rootDir);
            bool hasUncommittedChanges = !string.IsNullOrWhiteSpace(statusOutput);

            if (hasUncommittedChanges)
            {
                Console.WriteLine("\nPending changes detected in working tree:");
                Console.ForegroundColor = ConsoleColor.DarkCyan;
                Console.WriteLine(statusOutput.TrimEnd());
                Console.ResetColor();
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("[i] Working tree is clean (no modified or untracked files).");
                Console.ResetColor();
            }

            // Check if there are unpushed commits
            string unpushedCommits = RunProcessWithOutput("git", "log origin/" + TargetBranch + "..HEAD --oneline", rootDir);
            bool hasUnpushedCommits = !string.IsNullOrWhiteSpace(unpushedCommits);
            if (hasUnpushedCommits)
            {
                Console.WriteLine("\nUnpushed commits ready for GitHub:");
                Console.ForegroundColor = ConsoleColor.Magenta;
                Console.WriteLine(unpushedCommits.TrimEnd());
                Console.ResetColor();
            }

            if (!hasUncommittedChanges && !hasUnpushedCommits)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("\n[+] Repository is already fully up to date with " + TargetRepoUrl + "!");
                Console.ResetColor();
                Console.Write("\nDo you still want to force push or re-sync? (y/n): ");
                string reSync = Console.ReadLine();
                if (string.IsNullOrWhiteSpace(reSync) || !reSync.Trim().Equals("y", StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine("\nNo action needed. Exiting.");
                    ExitPrompt(0);
                    return;
                }
            }

            // Step 4: Prompt for Commit Message
            string commitMessage = "";
            if (hasUncommittedChanges)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("\n[Step 4/5] Commit Message Input");
                Console.ResetColor();

                while (true)
                {
                    Console.ForegroundColor = ConsoleColor.Cyan;
                    Console.Write("\nEnter commit message: ");
                    Console.ResetColor();

                    commitMessage = Console.ReadLine();
                    if (!string.IsNullOrWhiteSpace(commitMessage))
                    {
                        commitMessage = commitMessage.Trim();
                        break;
                    }

                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[-] Commit message cannot be empty. Please enter a valid message (or type 'q' to cancel).");
                    Console.ResetColor();

                    Console.Write("> ");
                    string check = Console.ReadLine();
                    if (check != null && check.Trim().Equals("q", StringComparison.OrdinalIgnoreCase))
                    {
                        Console.WriteLine("\n[!] Operation cancelled by user.");
                        ExitPrompt(0);
                        return;
                    }
                    if (!string.IsNullOrWhiteSpace(check))
                    {
                        commitMessage = check.Trim();
                        break;
                    }
                }
            }
            else
            {
                Console.WriteLine("\nNo new uncommitted files; pushing existing local commits to GitHub.");
            }

            // Step 5: Ask for y/n Confirmation
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n========================================================================");
            Console.WriteLine("  COMMIT & PUSH PREVIEW");
            Console.WriteLine("========================================================================");
            Console.ResetColor();
            Console.WriteLine("  Target Remote : " + TargetRepoUrl);
            Console.WriteLine("  Target Branch : " + TargetBranch);
            if (!string.IsNullOrEmpty(commitMessage))
            {
                Console.WriteLine("  Commit Message: \"" + commitMessage + "\"");
            }
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("========================================================================");
            Console.ResetColor();

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.Write("\nAre you sure you want to proceed with commit and push? (y/n): ");
            Console.ResetColor();

            string confirmation = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(confirmation) ||
                (!confirmation.Trim().Equals("y", StringComparison.OrdinalIgnoreCase) &&
                 !confirmation.Trim().Equals("yes", StringComparison.OrdinalIgnoreCase)))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("\n[-] Operation cancelled by user. No changes were committed or pushed.");
                Console.ResetColor();
                ExitPrompt(0);
                return;
            }

            // Step 6: Perform Git Add, Commit, and Push
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 5/5] Executing Git & GitHub CLI push...");
            Console.ResetColor();

            if (hasUncommittedChanges)
            {
                Console.WriteLine("\n[*] Staging all changes (git add -A)...");
                int addResult = RunProcessStreaming("git", "add -A", rootDir);
                if (addResult != 0)
                {
                    PrintError("Failed to stage changes with git add.");
                    ExitPrompt(1);
                    return;
                }
                PrintSuccess("All files staged.");

                Console.WriteLine("\n[*] Committing changes (git commit)...");
                string escapedMsg = commitMessage.Replace("\"", "\\\"");
                int commitResult = RunProcessStreaming("git", "commit -m \"" + escapedMsg + "\"", rootDir);
                if (commitResult != 0)
                {
                    PrintError("Failed to create commit.");
                    ExitPrompt(1);
                    return;
                }
                PrintSuccess("Commit created successfully.");
            }

            // Ensure branch name is main
            RunProcessStreaming("git", "branch -M " + TargetBranch, rootDir);

            // Push to remote repository
            Console.WriteLine("\n[*] Pushing to GitHub (" + TargetRepoGit + ")...");
            int pushResult = RunProcessStreaming("git", "push -u origin " + TargetBranch, rootDir);
            if (pushResult != 0)
            {
                PrintError("Failed to push to GitHub.");
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("\nTroubleshooting tips:");
                Console.WriteLine("  1. If GitHub authentication failed, run 'gh auth login' in your terminal.");
                Console.WriteLine("  2. Ensure your account has write access to https://github.com/Rishkek/PES_SEC3GCSE_CNPROJ_X");
                Console.WriteLine("  3. If remote contains conflicting commits, run 'git pull --rebase origin main' first.");
                Console.ResetColor();
                ExitPrompt(1);
                return;
            }

            // Display success verification
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine(@"
========================================================================
  [SUCCESS] Repository Successfully Updated & Pushed to GitHub!
========================================================================");
            Console.ResetColor();
            Console.WriteLine("\nAll latest files and commits are now live on GitHub at:");
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("  🔗 " + TargetRepoUrl);
            Console.ResetColor();

            // If gh is available, show latest commit info
            if (hasGh)
            {
                Console.WriteLine("\n[*] Remote repository status:");
                RunProcessStreaming("gh", "repo view Rishkek/PES_SEC3GCSE_CNPROJ_X", rootDir);
            }

            ExitPrompt(0);
        }

        static void EnsureGitRemote(string rootDir)
        {
            string remotes = RunProcessWithOutput("git", "remote -v", rootDir);
            if (string.IsNullOrWhiteSpace(remotes))
            {
                Console.WriteLine("[*] Configuring remote 'origin' -> " + TargetRepoGit);
                RunProcessStreaming("git", "remote add origin " + TargetRepoGit, rootDir);
            }
            else if (!remotes.Contains("PES_SEC3GCSE_CNPROJ_X"))
            {
                Console.WriteLine("[*] Updating remote 'origin' -> " + TargetRepoGit);
                RunProcessStreaming("git", "remote set-url origin " + TargetRepoGit, rootDir);
            }
            else
            {
                PrintSuccess("Remote 'origin' is configured to " + TargetRepoUrl);
            }
        }

        static string LocateProjectRoot()
        {
            string current = AppDomain.CurrentDomain.BaseDirectory;
            while (!string.IsNullOrEmpty(current))
            {
                if (Directory.Exists(Path.Combine(current, "backend")) && Directory.Exists(Path.Combine(current, "frontend")))
                {
                    return current;
                }
                DirectoryInfo parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }
            return Directory.GetCurrentDirectory();
        }

        static bool TestExecutable(string command, string arguments, out string output)
        {
            output = "";
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = arguments,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using (Process proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        proc.WaitForExit(5000);
                        output = proc.StandardOutput.ReadToEnd() + proc.StandardError.ReadToEnd();
                        return proc.ExitCode == 0;
                    }
                }
            }
            catch { }
            return false;
        }

        static string RunProcessWithOutput(string command, string arguments, string workingDirectory)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = arguments,
                    WorkingDirectory = workingDirectory,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using (Process proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        proc.WaitForExit(10000);
                        return proc.StandardOutput.ReadToEnd();
                    }
                }
            }
            catch { }
            return "";
        }

        static int RunProcessStreaming(string command, string arguments, string workingDirectory)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = arguments,
                    WorkingDirectory = workingDirectory,
                    UseShellExecute = false,
                    CreateNoWindow = false
                };
                using (Process proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        proc.WaitForExit();
                        return proc.ExitCode;
                    }
                }
            }
            catch (Exception ex)
            {
                PrintError("Failed to execute: " + command + " " + arguments + " (" + ex.Message + ")");
            }
            return -1;
        }

        static void PrintSuccess(string message)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[+] " + message);
            Console.ResetColor();
        }

        static void PrintError(string message)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[-] " + message);
            Console.ResetColor();
        }

        static void ExitPrompt(int exitCode)
        {
            Console.WriteLine("\nPress any key to exit...");
            try { Console.ReadKey(); } catch { }
            Environment.Exit(exitCode);
        }
    }
}
