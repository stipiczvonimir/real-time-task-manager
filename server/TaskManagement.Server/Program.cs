using Microsoft.EntityFrameworkCore;
using TaskManagement.Server.Data;
using TaskManagement.Server.Hubs;
using TaskManagement.Server.Ipc;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddControllers();

builder.Services.AddSignalR();

builder.Services.AddHostedService<NamedPipeIpcService>();

builder.Services.AddDbContext<TasksDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .SetIsOriginAllowed(_ => true));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("DevCors");

app.MapControllers();

app.MapHub<TasksHub>("/hubs/tasks");

app.Run();