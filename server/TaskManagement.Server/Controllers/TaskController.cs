using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Server.Data;
using TaskManagement.Server.Models;
using TaskManagement.Server.Hubs;

namespace TaskManagement.Server.Controllers;

[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private readonly TasksDbContext _db;
    private readonly IHubContext<TasksHub> _hub;

    public TasksController(TasksDbContext db, IHubContext<TasksHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    [HttpGet]
    public async Task<ActionResult<List<TaskItem>>> GetAll()
    {
        var task = await _db.Tasks
            .OrderByDescending(t => t.UpdatedAt).ToListAsync();

        return Ok(task);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaskItem>> GetById(int id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null)
            return NotFound();

        return Ok(task);
    }

    [HttpPost]
    public async Task<ActionResult<TaskItem>> Create([FromBody] CreateTaskRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest("Title requiered");

        var now = DateTime.UtcNow;

        var task = new TaskItem
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            Status = request.Status ?? TaskItemStatus.TODO,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("Task created", task);

        return CreatedAtAction(nameof(GetById), new { id = task.Id }, task);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<TaskItem>> Update(int id, [FromBody] UpdateTaskRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null)
            return NotFound();

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest("Title required");

            task.Title = title;
        }

        if (request.Description is not null)
        {
            task.Description = request.Description.Trim();
        }

        if (request.Status.HasValue)
        {
            task.Status = request.Status.Value;
        }

        task.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("Task changed", task);

        return Ok(task);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null)
            return NotFound();

        _db.Tasks.Remove(task);

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("Task deleted", task);

        return NoContent();
    }



    public sealed class CreateTaskRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public TaskItemStatus? Status { get; set; }
    }

    public sealed class UpdateTaskRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public TaskItemStatus? Status { get; set; }
    }
}