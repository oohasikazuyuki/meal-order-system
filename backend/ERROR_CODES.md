# API Error Codes

## Response Format

All API errors should follow this shape:

```json
{
  "error": {
    "code": "ORDER-VALIDATION-001",
    "message": "注文日が不正です",
    "details": {
      "order_date": "YYYY-MM-DD 形式で指定してください"
    },
    "request_id": "req_xxxxx"
  }
}
```

For backward compatibility, some endpoints still return top-level `message` or `errors`.

## Code Catalog (v1)

### Common

- `COMMON-VALIDATION-001`
- `COMMON-AUTH-001`
- `COMMON-AUTH-002`
- `COMMON-AUTHZ-001`
- `COMMON-NOTFOUND-001`
- `COMMON-CONFLICT-001`
- `COMMON-INTERNAL-001`

### Order

- `ORDER-VALIDATION-001` (invalid order date)
- `ORDER-VALIDATION-002` (invalid quantity)
- `ORDER-DUPLICATE-001`
- `ORDER-STATE-001` (not editable)
- `ORDER-STATE-002` (not cancellable)

### AI / Menu / Supplier

- `MENU-VALIDATION-001`
- `AI-PARSE-001`
- `SUPPLIER-NOTFOUND-001`

## Notes

- `code` is for machine handling (frontend branching, logs, monitoring).
- `message` is for user/developer readability.
- Keep existing codes stable once published.