declare type RouteContext<_Route extends string = string> = { params: Promise<{ id: string }> };
