using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace NetLabSetup
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "NetLab Setup & Dependency Installer";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"
========================================================================
    _   _      _   _          _     
   | \ | | ___| |_| |    __ _| |__  
   |  \| |/ _ \ __| |   / _` | '_ \ 
   | |\  |  __/ |_| |__| (_| | |_) |
   |_| \_|\___|\__|_____\__,_|_.__/ 
   Congestion Detection & Traffic Rerouting Lab
   Automated Dependency Installer & Environment Setup
========================================================================");
            Console.ResetColor();

            string rootDir = LocateProjectRoot();
            Console.WriteLine("\n[*] Project Root: " + rootDir);

            // Step 1: Detect Python
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 1/5] Searching for Python 3 installation...");
            Console.ResetColor();

            string pythonExe = FindPythonExecutable(rootDir);
            if (string.IsNullOrEmpty(pythonExe))
            {
                PrintError("Python 3 could not be found automatically.");
                Console.WriteLine("Please install Python 3.10+ from https://www.python.org/downloads/");
                Console.WriteLine("Make sure to check 'Add python.exe to PATH' during installation.");
                ExitPrompt(1);
                return;
            }
            PrintSuccess("Found Python: " + pythonExe);

            // Step 2: Detect Node.js & npm
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 2/5] Searching for Node.js and npm...");
            Console.ResetColor();

            string npmCmd = FindNpmExecutable();
            if (string.IsNullOrEmpty(npmCmd))
            {
                PrintError("npm / Node.js could not be found.");
                Console.WriteLine("Please install Node.js 18+ from https://nodejs.org/");
                ExitPrompt(1);
                return;
            }
            PrintSuccess("Found npm: " + npmCmd);

            // Step 3: Create Python Virtual Environment (.venv)
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 3/5] Setting up Python virtual environment (.venv)...");
            Console.ResetColor();

            string venvDir = Path.Combine(rootDir, ".venv");
            string venvPython = Path.Combine(venvDir, "Scripts", "python.exe");

            if (!File.Exists(venvPython))
            {
                Console.WriteLine("Creating virtual environment at: " + venvDir);
                int exitCode = RunProcess(pythonExe, "-m venv .venv", rootDir);
                if (exitCode != 0 || !File.Exists(venvPython))
                {
                    PrintError("Failed to create Python virtual environment.");
                    ExitPrompt(1);
                    return;
                }
                PrintSuccess("Created virtual environment: " + venvDir);
            }
            else
            {
                PrintSuccess("Virtual environment verified: " + venvDir);
            }

            // Step 4: Install Python Dependencies
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 4/5] Installing Python backend dependencies from requirements.txt...");
            Console.ResetColor();

            Console.WriteLine("--> Upgrading pip...");
            RunProcess(venvPython, "-m pip install --upgrade pip", rootDir);

            string reqFile = Path.Combine(rootDir, "requirements.txt");
            if (!File.Exists(reqFile))
            {
                reqFile = Path.Combine(rootDir, "backend", "requirements.txt");
            }

            Console.WriteLine("--> Installing packages: fastapi, uvicorn, pydantic, numpy, websockets, pytest, httpx...");
            int pipExitCode = RunProcess(venvPython, "-m pip install -r \"" + reqFile + "\"", rootDir);
            if (pipExitCode != 0)
            {
                PrintError("pip install encountered an error. Please inspect the log above.");
                ExitPrompt(1);
                return;
            }
            PrintSuccess("Python backend dependencies installed successfully!");

            // Step 5: Install Frontend Dependencies
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Step 5/5] Installing React & Vite frontend dependencies (npm install)...");
            Console.ResetColor();

            string frontendDir = Path.Combine(rootDir, "frontend");
            if (Directory.Exists(frontendDir))
            {
                int npmExitCode = RunProcess(npmCmd, "install", frontendDir);
                if (npmExitCode != 0)
                {
                    PrintError("npm install encountered an error. Please inspect the log above.");
                    ExitPrompt(1);
                    return;
                }
                PrintSuccess("Frontend npm dependencies installed successfully!");
            }
            else
            {
                PrintError("Frontend directory not found at: " + frontendDir);
            }

            // Step 6: Verify Test Suite
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[Verification] Running automated test suite (pytest)...");
            Console.ResetColor();

            int testExit = RunProcess(venvPython, "-m pytest -o pythonpath=backend backend/tests", rootDir);
            if (testExit == 0)
            {
                PrintSuccess("Verification passed! All automated simulation and protocol tests succeeded.");
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[!] Note: Tests completed with exit code " + testExit);
                Console.ResetColor();
            }

            // Completion Banner
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine(@"
========================================================================
  [SUCCESS] NetLab Prerequisites & Dependencies Are Installed!
========================================================================");
            Console.ResetColor();

            Console.WriteLine("\nPrerequisite installation is complete!");
            Console.WriteLine("\nTo run the application:");
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("  👉 Double-click 'run.exe' (or execute .\\run.exe in terminal)");
            Console.ResetColor();
            Console.WriteLine("\nOr start manually in two terminals:");
            Console.WriteLine("  1. Backend Server:");
            Console.WriteLine("     .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir backend");
            Console.WriteLine("  2. Frontend UI:");
            Console.WriteLine("     cd frontend && npm run dev");
            Console.WriteLine("\n  Access Web App at: http://localhost:5173");
            Console.WriteLine("  API Documentation: http://localhost:8000/docs");

            ExitPrompt(0);
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

        static string FindPythonExecutable(string rootDir)
        {
            // 1. Check existing .venv
            string venvPy = Path.Combine(rootDir, ".venv", "Scripts", "python.exe");
            if (File.Exists(venvPy) && TestExecutable(venvPy, "--version"))
            {
                return venvPy;
            }

            // 2. Candidate paths
            List<string> candidates = new List<string>();
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

            if (!string.IsNullOrEmpty(localAppData))
            {
                candidates.Add(Path.Combine(localAppData, "Python", "bin", "python.exe"));
                candidates.Add(Path.Combine(localAppData, "Python", "pythoncore-3.14-64", "python.exe"));
                candidates.Add(Path.Combine(localAppData, "Programs", "Python", "Python314", "python.exe"));
                candidates.Add(Path.Combine(localAppData, "Programs", "Python", "Python313", "python.exe"));
                candidates.Add(Path.Combine(localAppData, "Programs", "Python", "Python312", "python.exe"));
                candidates.Add(Path.Combine(localAppData, "Programs", "Python", "Python311", "python.exe"));
                candidates.Add(Path.Combine(localAppData, "Programs", "Python", "Python310", "python.exe"));
            }

            candidates.Add(@"C:\Python314\python.exe");
            candidates.Add(@"C:\Python313\python.exe");
            candidates.Add(@"C:\Python312\python.exe");
            candidates.Add(@"C:\Python311\python.exe");
            candidates.Add(@"C:\Python310\python.exe");

            if (!string.IsNullOrEmpty(programFiles))
            {
                candidates.Add(Path.Combine(programFiles, "Python314", "python.exe"));
                candidates.Add(Path.Combine(programFiles, "Python313", "python.exe"));
                candidates.Add(Path.Combine(programFiles, "Python312", "python.exe"));
                candidates.Add(Path.Combine(programFiles, "Python311", "python.exe"));
                candidates.Add(Path.Combine(programFiles, "Python310", "python.exe"));
            }

            // Check py launcher
            if (TestExecutable("py", "-3 --version"))
            {
                return "py -3";
            }

            // Test candidate file paths
            foreach (string path in candidates)
            {
                if (File.Exists(path) && TestExecutable(path, "--version"))
                {
                    return path;
                }
            }

            // Check standard 'python' command
            if (TestExecutable("python", "--version"))
            {
                return "python";
            }

            return null;
        }

        static string FindNpmExecutable()
        {
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            if (!string.IsNullOrEmpty(programFiles))
            {
                string pfNode = Path.Combine(programFiles, "nodejs", "npm.cmd");
                if (File.Exists(pfNode)) return pfNode;
            }

            string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            if (!string.IsNullOrEmpty(programFilesX86))
            {
                string pfNodeX86 = Path.Combine(programFilesX86, "nodejs", "npm.cmd");
                if (File.Exists(pfNodeX86)) return pfNodeX86;
            }

            string pathVar = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathVar))
            {
                foreach (string dir in pathVar.Split(';'))
                {
                    string trimmed = dir.Trim();
                    if (string.IsNullOrEmpty(trimmed)) continue;
                    try
                    {
                        string candidate = Path.Combine(trimmed, "npm.cmd");
                        if (File.Exists(candidate)) return candidate;
                    }
                    catch { }
                }
            }

            if (TestExecutable("cmd.exe", "/c npm --version"))
            {
                return "npm.cmd";
            }
            return null;
        }

        static bool TestExecutable(string command, string arguments)
        {
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
                        proc.WaitForExit(3000);
                        string output = proc.StandardOutput.ReadToEnd() + proc.StandardError.ReadToEnd();
                        return proc.ExitCode == 0 && !output.Contains("was not found") && !output.Contains("Microsoft Store");
                    }
                }
            }
            catch { }
            return false;
        }

        static int RunProcess(string command, string arguments, string workingDirectory)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                if (command.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase) || command.EndsWith(".bat", StringComparison.OrdinalIgnoreCase))
                {
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c \"" + command + "\" " + arguments;
                }
                else
                {
                    psi.FileName = command;
                    psi.Arguments = arguments;
                }
                psi.WorkingDirectory = workingDirectory;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = false;

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
            Console.WriteLine("\nPress any key to exit setup...");
            try { Console.ReadKey(); } catch { }
            Environment.Exit(exitCode);
        }
    }
}
