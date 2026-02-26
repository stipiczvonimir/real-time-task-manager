namespace TaskManagement.Server.Models;

public class TaskItem
{
    public int Id {get; set;}

    public string Title {get; set;} = string.Empty;
    public string? Description {get; set;}

    public string Status {get; set;} = "TODO";

    public DateTime CreatedAt {get; set;} = DateTime.UtcNow;
    public DateTime UpdatedAt {get; set;} = DateTime.UtcNow;
}