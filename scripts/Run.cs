using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace NetLabRunner
{
    class Program
    {
        private static Process _backendProcess;
        private static Process _frontendProcess;
        private static bool _isShuttingDown = false;
        private static readonly object _lock = new object();

        static void Main(string[] args)
        {
            Console.Title = "NetLab — Application Runner";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"
========================================================================
    _   _      _   _          _     
   | \ | | ___| |_| |    __ _| |__  
   |  \| |/ _ \ __| |   / _` | '_ \ 
   | |\  |  __/ |_| |__| (_| | |_) |
   |_| \_|\___|\__|_____\__,_|_.__/ 
   Congestion Detection & Traffic Rerouting Lab
   Application Runner
========================================================================");
            Console.ResetColor();

            string rootDir = LocateProjectRoot();
            Console.WriteLine("[*] Project Root: " + rootDir);

            // Hook exit handlers for clean shutdown
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e)
            {
                e.Cancel = true;
                StopAll();
                Environment.Exit(0);
            };
            AppDomain.CurrentDomain.ProcessExit += delegate
            {
                StopAll();
            };

            // 1. Verify Virtual Environment
            string venvPython = Path.Combine(rootDir, ".venv", "Scripts", "python.exe");
            if (!File.Exists(venvPython))
            {
                PrintError("Python virtual environment was not found at:");
                Console.WriteLine("    " + venvPython);
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("\n[!] Please run 'setup.exe' first to install all prerequisites and dependencies.");
                Console.ResetColor();
                ExitPrompt(1);
                return;
            }

            // 2. Verify Frontend Directory
            string frontendDir = Path.Combine(rootDir, "frontend");
            if (!Directory.Exists(frontendDir))
            {
                PrintError("Frontend directory was not found at: " + frontendDir);
                ExitPrompt(1);
                return;
            }

            string nodeModules = Path.Combine(frontendDir, "node_modules");
            if (!Directory.Exists(nodeModules))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[!] Warning: 'frontend/node_modules' was not found.");
                Console.WriteLine("    If the frontend fails to launch, please run 'setup.exe' first.");
                Console.ResetColor();
            }

            string npmCmd = FindNpmExecutable();

            // 3. Launch Backend
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n[1/2] Starting Backend Server (FastAPI)...");
            Console.ResetColor();
            Console.WriteLine("      URL:  http://127.0.0.1:8000");
            Console.WriteLine("      Docs: http://127.0.0.1:8000/docs");

            try
            {
                string backendCmd = string.Format("/k \"\"{0}\" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir backend\"", venvPython);
                ProcessStartInfo psiBackend = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = backendCmd,
                    WorkingDirectory = rootDir,
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Normal
                };
                _backendProcess = Process.Start(psiBackend);
            }
            catch (Exception ex)
            {
                PrintError("Failed to start backend: " + ex.Message);
                ExitPrompt(1);
                return;
            }

            // 4. Launch Frontend
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n[2/2] Starting Frontend UI (Vite + React)...");
            Console.ResetColor();
            Console.WriteLine("      URL:  http://localhost:5173");

            try
            {
                string npmRunArg;
                if (!string.IsNullOrEmpty(npmCmd) && File.Exists(npmCmd))
                {
                    npmRunArg = string.Format("/k \"\"{0}\" run dev\"", npmCmd);
                }
                else
                {
                    npmRunArg = "/k \"npm run dev\"";
                }

                ProcessStartInfo psiFrontend = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = npmRunArg,
                    WorkingDirectory = frontendDir,
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Normal
                };
                _frontendProcess = Process.Start(psiFrontend);
            }
            catch (Exception ex)
            {
                PrintError("Failed to start frontend: " + ex.Message);
                StopAll();
                ExitPrompt(1);
                return;
            }

            // 5. Open Browser
            Console.WriteLine("\n[*] Launching web browser in 2 seconds...");
            Thread.Sleep(2000);
            try
            {
                Process.Start("http://localhost:5173");
            }
            catch { }

            // 6. Running Dashboard
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine(@"
========================================================================
  [ONLINE] NetLab Simulation Suite is Running!
========================================================================");
            Console.ResetColor();
            Console.WriteLine("  * Frontend Web UI:        http://localhost:5173");
            Console.WriteLine("  * Backend REST API:       http://127.0.0.1:8000");
            Console.WriteLine("  * Interactive API Docs:   http://127.0.0.1:8000/docs");
            Console.WriteLine("  * WebSocket Streaming:    ws://127.0.0.1:8000/api/v1/ws/{sim_id}");
            Console.WriteLine("========================================================================");
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("\nControls:");
            Console.WriteLine("  [O] Re-open Web UI in default browser (http://localhost:5173)");
            Console.WriteLine("  [B] Open Backend API Swagger Docs (http://127.0.0.1:8000/docs)");
            Console.WriteLine("  [Q] Stop all servers and exit");
            Console.ResetColor();
            Console.WriteLine("\nMonitoring running processes... (Press 'Q' to quit)");

            while (true)
            {
                if (Console.KeyAvailable)
                {
                    ConsoleKeyInfo key = Console.ReadKey(true);
                    if (key.Key == ConsoleKey.Q)
                    {
                        Console.WriteLine("\nShutting down NetLab servers...");
                        StopAll();
                        break;
                    }
                    else if (key.Key == ConsoleKey.O)
                    {
                        Console.WriteLine("[*] Opening http://localhost:5173 in browser...");
                        try { Process.Start("http://localhost:5173"); } catch { }
                    }
                    else if (key.Key == ConsoleKey.B)
                    {
                        Console.WriteLine("[*] Opening http://127.0.0.1:8000/docs in browser...");
                        try { Process.Start("http://127.0.0.1:8000/docs"); } catch { }
                    }
                }

                // Check if both child processes were manually closed
                bool backendAlive = _backendProcess != null && !_backendProcess.HasExited;
                bool frontendAlive = _frontendProcess != null && !_frontendProcess.HasExited;

                if (!backendAlive && !frontendAlive)
                {
                    Console.WriteLine("\nBoth server windows have exited.");
                    break;
                }

                Thread.Sleep(250);
            }

            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\nNetLab has exited cleanly.");
            Console.ResetColor();
        }

        private static void StopAll()
        {
            lock (_lock)
            {
                if (_isShuttingDown) return;
                _isShuttingDown = true;

                KillProcessTree(_backendProcess);
                KillProcessTree(_frontendProcess);

                _backendProcess = null;
                _frontendProcess = null;
            }
        }

        private static void KillProcessTree(Process proc)
        {
            if (proc == null) return;
            try
            {
                if (!proc.HasExited)
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "taskkill",
                        Arguments = "/F /T /PID " + proc.Id,
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    using (Process killer = Process.Start(psi))
                    {
                        if (killer != null) killer.WaitForExit(2000);
                    }
                }
            }
            catch { }
        }

        private static string LocateProjectRoot()
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

        private static string FindNpmExecutable()
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

            return "npm.cmd";
        }

        private static void PrintError(string message)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[-] " + message);
            Console.ResetColor();
        }

        private static void ExitPrompt(int exitCode)
        {
            Console.WriteLine("\nPress any key to exit...");
            try { Console.ReadKey(); } catch { }
            Environment.Exit(exitCode);
        }
    }
}
