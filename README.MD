# Real-Time Task Management System

This project implements a system where users can manage simple tasks (create, read, update, delete) from two different clients, with changes persisted in a SQL database and reflected in real time across clients.

## Architecture

### Backend
* ASP.NET Core
* Entity Framework Core
* SignalR
* SQLite

### Web client
* React
* TypeScript
* Vite

### CLI (Windows only)
* Python
* pywin32

## Getting Started

### Prerequisites

* .NET8+
* Node.js 18+
* Python 3.10+

### Running the project

To download the project run:
```
git clone https://github.com/stipiczvonimir/real-time-task-manager.git
```
To start the server and web-client, once inside the repo, run:
```
cd real-time-task-manager

npm install
npm run start
```
Web-client will be available at:
```
http://localhost:5173
```
Python
```
cd python-client
pip install -r requirements.txt
```


## Help

To use Python CLI run:
```
python client.py list
```
Create a task:
```
python client.py create --title "Example task" --description "Custom description" --status TODO
```
Update a task:
```
python client.py update --id 1 --description "New descrtiption" --title "Updated title"
```
Delete a task:
```
python client.py delete --id 1
```

## Demo video
https://youtu.be/S8fxgSgPPH4
