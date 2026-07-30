%dw 2.0
output application/json
---
{
  appName: payload.metadata.name,
  replicas: payload.spec.replicas,
  environments: payload.spec.template.spec.containers map (container) -> {
    containerName: container.name,
    variables: { (
        (container.env default []) map (envVar) -> {
          (envVar.name): envVar.value
        }
      ) }
  }
}
