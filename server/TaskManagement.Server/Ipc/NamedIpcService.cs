using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Server.Data;
using TaskManagement.Server.Hubs;
using TaskManagement.Server.Models;

namespace TaskManagement.Server.Ipc;

public sealed class NamedPipeIpcService : BackgroundService
{
    private const string PipeName = "taskmanagement-ipc";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NamedPipeIpcService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public NamedPipeIpcService(IServiceScopeFactory scopeFactory, ILogger<NamedPipeIpcService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("IPC started. Pipe: \\\\.\\pipe\\{PipeName}", PipeName);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var pipe = new NamedPipeServerStream(
                    PipeName,
                    PipeDirection.InOut,
                    maxNumberOfServerInstances: 1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                await pipe.WaitForConnectionAsync(stoppingToken);

                var response = await HandleSingleRequestAsync(pipe, stoppingToken);

                var json = JsonSerializer.Serialize(response, JsonOptions);
                var bytes = Encoding.UTF8.GetBytes(json + "\n");
                await pipe.WriteAsync(bytes, stoppingToken);
                await pipe.FlushAsync(stoppingToken);

                pipe.Disconnect();
            }
            catch (OperationCanceledException)
            {

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "IPC error");
                await Task.Delay(200, stoppingToken);
            }
        }
    }

    private async Task<IpcResponse> HandleSingleRequestAsync(Stream pipe, CancellationToken ct)
    {
        using var reader = new StreamReader(pipe, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 4096, leaveOpen: true);

        var line = await reader.ReadLineAsync(ct);
        if (string.IsNullOrWhiteSpace(line))
            return IpcResponse.Fail("Empty request");

        IpcRequest? req;
        try
        {
            req = JsonSerializer.Deserialize<IpcRequest>(line, JsonOptions);
        }
        catch
        {
            return IpcResponse.Fail("Invalid JSON");
        }

        if (req is null || string.IsNullOrWhiteSpace(req.Action))
            return IpcResponse.Fail("No action");

        var action = req.Action.Trim().ToLowerInvariant();

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TasksDbContext>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<TasksHub>>();

        switch (action)
        {
            case "list":
            {
                var tasks = await db.Tasks
                    .OrderByDescending(t => t.UpdatedAt)
                    .ToListAsync(ct);

                return IpcResponse.Success(tasks);
            }

            case "create":
            {
                if (string.IsNullOrWhiteSpace(req.Title))
                    return IpcResponse.Fail("Title required");

                var now = DateTime.UtcNow;

                var task = new TaskItem
                {
                    Title = req.Title.Trim(),
                    Description = req.Description?.Trim(),
                    Status = string.IsNullOrWhiteSpace(req.Status)
                        ? TaskItemStatus.TODO
                        : Enum.Parse<TaskItemStatus>(req.Status.Trim(), true),
                    CreatedAt = now,
                    UpdatedAt = now
                };

                db.Tasks.Add(task);
                await db.SaveChangesAsync(ct);

                await hub.Clients.All.SendAsync("Task changed", task, ct);

                return IpcResponse.Success(task);
            }

            case "update":
            {
                if (req.Id is null || req.Id <= 0)
                    return IpcResponse.Fail("Id required");

                var task = await db.Tasks.FindAsync([req.Id.Value], ct);
                if (task is null)
                    return IpcResponse.Fail("Not found");

                if (req.Title is not null)
                {
                    if (string.IsNullOrWhiteSpace(req.Title))
                        return IpcResponse.Fail("Title requiered");
                    task.Title = req.Title.Trim();
                }

                if (req.Description is not null)
                {
                    task.Description = req.Description.Trim();
                }

                if (req.Status is not null)
                {
                    if (string.IsNullOrWhiteSpace(req.Status))
                        return IpcResponse.Fail("Status requiered");
                    task.Status = Enum.Parse<TaskItemStatus>(req.Status.Trim(), true);
                }

                task.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);

                await hub.Clients.All.SendAsync("Task changed", task, ct);

                return IpcResponse.Success(task);
            }

            case "delete":
            {
                if (req.Id is null || req.Id <= 0)
                    return IpcResponse.Fail("Id required");

                var task = await db.Tasks.FindAsync([req.Id.Value], ct);
                if (task is null)
                    return IpcResponse.Fail("Not found");

                db.Tasks.Remove(task);
                await db.SaveChangesAsync(ct);

                await hub.Clients.All.SendAsync("Task deleted", req.Id.Value, ct);

                return IpcResponse.Success(new { id = req.Id.Value });
            }

            default:
                return IpcResponse.Fail("Unknown action. Use list/create/update/delete.");
        }
    }
}