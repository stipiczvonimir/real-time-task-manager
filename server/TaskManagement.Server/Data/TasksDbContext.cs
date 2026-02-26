using Microsoft.EntityFrameworkCore;
using TaskManagement.Server.Models;

namespace TaskManagement.Server.Data;

public class TasksDbContext : DbContext
{
    public TasksDbContext(DbContextOptions<TasksDbContext>options)
        :base(options){}

    public DbSet<TaskItem> Tasks => Set<TaskItem>();
}