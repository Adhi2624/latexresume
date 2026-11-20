# MCP server

`POST /mcp` implements the [Model Context Protocol](https://modelcontextprotocol.io) over Streamable HTTP
(stateless, JSON responses). Authenticate with `Authorization: Bearer lrp_…` using a token from **Settings**.

| Tool | Arguments | Description |
| --- | --- | --- |
| `list_templates` | – | Built-in templates |
| `list_resumes` | – | Your resumes (metadata) |
| `get_resume` | `id` | Resume with LaTeX source |
| `create_resume` | `title`, `template_id?`, `latex_source?` | Create from a template or raw LaTeX |
| `update_resume` | `id`, `title?`, `latex_source?` | Edit |
| `delete_resume` | `id` | Delete |
| `compile_resume` | `id` | Compile; returns the TeX error on failure. Download the PDF at `GET /api/resumes/{id}/pdf` with the same token |
| `publish_resume` / `unpublish_resume` | `id` | Toggle the public page `/r/{slug}` |

## Claude Code

```bash
claude mcp add --transport http latexresume https://YOUR-HOST/mcp --header "Authorization: Bearer lrp_…"
```

## Manual test

```bash
curl -s https://YOUR-HOST/mcp -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
