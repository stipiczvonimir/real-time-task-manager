using System.Text.Json.Serialization;

namespace TaskManagement.Server.Ipc;

public sealed class IpcRequest
{
    [JsonPropertyName("action")]
    public string Action { get; set; } = string.Empty;

    [JsonPropertyName("id")]
    public int? Id { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }
}

public sealed class IpcResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("data")]
    public object? Data { get; set; }

    public static IpcResponse Success(object? data = null) => new() { Ok = true, Data = data };
    public static IpcResponse Fail(string error) => new() { Ok = false, Error = error };
}