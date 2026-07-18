[
  {
    "expr": "(((sum(increase(mysql_mcp_tool_tokens_total[$__range]))) / 1000000) * 2)",
    "legendFormat": "{{tool}}",
    "refId": "A",
    "datasource": {
      "type": "prometheus",
      "uid": "prometheus_datasource"
    }
  },
  {
    "expr": "(((sum(increase(mysql_mcp_tool_tokens_total[$__range]))) / 1000000) * 5)",
    "legendFormat": "{{tool}}",
    "refId": "A",
    "datasource": {
      "type": "prometheus",
      "uid": "prometheus_datasource"
    }
  }
]
