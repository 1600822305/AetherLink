package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import okhttp3.*;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "CorsBypass")
public class CorsBypassPlugin extends Plugin {
    private static final String TAG = "CorsBypassPlugin";
    private final Map<String, SSEConnection> sseConnections = new HashMap<>();
    private int connectionCounter = 0;
    private OkHttpClient httpClient;

    @Override
    public void load() {
        super.load();
        
        // Initialize HTTP client
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
    }

    @PluginMethod
    public void request(PluginCall call) {
        makeHttpRequest(call, call.getString("method", "GET"));
    }

    @PluginMethod
    public void get(PluginCall call) {
        makeHttpRequest(call, "GET");
    }

    @PluginMethod
    public void post(PluginCall call) {
        makeHttpRequest(call, "POST");
    }

    @PluginMethod
    public void put(PluginCall call) {
        makeHttpRequest(call, "PUT");
    }

    @PluginMethod
    public void patch(PluginCall call) {
        makeHttpRequest(call, "PATCH");
    }

    @PluginMethod
    public void delete(PluginCall call) {
        makeHttpRequest(call, "DELETE");
    }

    private void makeHttpRequest(PluginCall call, String method) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        JSObject headers = call.getObject("headers", new JSObject());
        JSObject params = call.getObject("params", new JSObject());
        Object data = call.getData().opt("data");
        double timeout = call.getDouble("timeout", 30.0);
        String responseType = call.getString("responseType", "json");
        boolean withCredentials = call.getBoolean("withCredentials", false);

        try {
            // Build URL with parameters
            HttpUrl.Builder urlBuilder = HttpUrl.parse(url).newBuilder();
            Iterator<String> paramKeys = params.keys();
            while (paramKeys.hasNext()) {
                String key = paramKeys.next();
                urlBuilder.addQueryParameter(key, params.getString(key));
            }
            HttpUrl requestUrl = urlBuilder.build();

            // Build request
            Request.Builder requestBuilder = new Request.Builder().url(requestUrl);

            // Add headers
            Iterator<String> headerKeys = headers.keys();
            while (headerKeys.hasNext()) {
                String key = headerKeys.next();
                requestBuilder.addHeader(key, headers.getString(key));
            }

            // Add body for non-GET requests
            RequestBody body = null;
            if (!method.equals("GET") && data != null) {
                MediaType mediaType = MediaType.parse("application/json; charset=utf-8");
                if (data instanceof JSONObject) {
                    body = RequestBody.create(mediaType, data.toString());
                } else if (data instanceof String) {
                    body = RequestBody.create(mediaType, (String) data);
                }
                
                if (!headers.has("Content-Type")) {
                    requestBuilder.addHeader("Content-Type", "application/json");
                }
            }

            requestBuilder.method(method, body);
            Request request = requestBuilder.build();

            // Configure client with timeout
            OkHttpClient client = httpClient.newBuilder()
                .connectTimeout((long) timeout, TimeUnit.SECONDS)
                .readTimeout((long) timeout, TimeUnit.SECONDS)
                .writeTimeout((long) timeout, TimeUnit.SECONDS)
                .build();

            // Execute request
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call httpCall, IOException e) {
                    call.reject("Request failed: " + e.getMessage());
                }

                @Override
                public void onResponse(Call httpCall, Response response) throws IOException {
                    try {
                        // Parse response headers
                        JSObject responseHeaders = new JSObject();
                        for (String name : response.headers().names()) {
                            responseHeaders.put(name, response.header(name));
                        }

                        // Parse response body
                        Object responseData = "";
                        if (response.body() != null) {
                            String bodyString = response.body().string();
                            
                            switch (responseType) {
                                case "text":
                                    responseData = bodyString;
                                    break;
                                case "json":
                                    try {
                                        responseData = new JSONObject(bodyString);
                                    } catch (JSONException e) {
                                        responseData = bodyString;
                                    }
                                    break;
                                case "blob":
                                case "arraybuffer":
                                    // Convert to base64 for transfer
                                    responseData = android.util.Base64.encodeToString(
                                        bodyString.getBytes(), android.util.Base64.DEFAULT);
                                    break;
                                default:
                                    try {
                                        responseData = new JSONObject(bodyString);
                                    } catch (JSONException e) {
                                        responseData = bodyString;
                                    }
                                    break;
                            }
                        }

                        JSObject result = new JSObject();
                        result.put("data", responseData);
                        result.put("status", response.code());
                        result.put("statusText", response.message());
                        result.put("headers", responseHeaders);
                        result.put("url", response.request().url().toString());

                        call.resolve(result);
                    } catch (Exception e) {
                        call.reject("Failed to parse response: " + e.getMessage());
                    }
                }
            });

        } catch (Exception e) {
            call.reject("Failed to create request: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSSE(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        connectionCounter++;
        String connectionId = "sse_" + connectionCounter;

        JSObject headers = call.getObject("headers", new JSObject());
        boolean withCredentials = call.getBoolean("withCredentials", false);
        double reconnectTimeout = call.getDouble("reconnectTimeout", 3.0);

        try {
            SSEConnection sseConnection = new SSEConnection(
                url, headers, withCredentials, reconnectTimeout, this, connectionId, httpClient
            );
            
            sseConnections.put(connectionId, sseConnection);
            sseConnection.connect();

            JSObject result = new JSObject();
            result.put("connectionId", connectionId);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to start SSE connection: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopSSE(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }

        SSEConnection connection = sseConnections.get(connectionId);
        if (connection != null) {
            connection.disconnect();
            sseConnections.remove(connectionId);
        }

        call.resolve();
    }

    // SSE event handlers
    public void notifySSEOpen(String connectionId) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("status", "connected");
        notifyListeners("sseOpen", data);
    }

    public void notifySSEMessage(String connectionId, String messageData, String id, String type) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("data", messageData);
        
        if (id != null) {
            data.put("id", id);
        }
        
        if (type != null) {
            data.put("type", type);
        }
        
        notifyListeners("sseMessage", data);
    }

    public void notifySSEError(String connectionId, String error) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("error", error);
        notifyListeners("sseError", data);
    }

    public void notifySSEClose(String connectionId) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("status", "disconnected");
        notifyListeners("sseClose", data);
    }
}
