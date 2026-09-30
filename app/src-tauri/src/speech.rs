//! Kokoro transport. Audio stays in memory; document text is never logged or stored here.
use std::time::Duration;

/// `{endpoint}/v1/audio/{what}` after the same checks as the speech URL.
fn api_url(endpoint: &str, what: &str) -> Result<reqwest::Url, String> {
    let mut url = speech_url(endpoint)?;
    let path = url.path().trim_end_matches("speech").to_string() + what;
    url.set_path(&path);
    Ok(url)
}

/// Voice ids from a Kokoro server's voice list: `{"voices": [...]}` or a bare array, with plain
/// strings or objects carrying `id` / `name`. Sorted; anything that isn't a plain id is dropped.
fn parse_voices(v: &serde_json::Value) -> Vec<String> {
    let list = v.get("voices").unwrap_or(v).as_array().cloned().unwrap_or_default();
    let mut out: Vec<String> = list
        .iter()
        .filter_map(|x| x.as_str().or_else(|| x.get("id").and_then(|i| i.as_str())).or_else(|| x.get("name").and_then(|i| i.as_str())))
        .filter(|id| !id.is_empty() && id.len() <= 80 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'))
        .map(String::from)
        .collect();
    out.sort();
    out.dedup();
    out
}

/// The voices a Kokoro server offers. Also the "is Kokoro running?" check (short timeout).
#[tauri::command]
pub async fn kokoro_voices(endpoint: String) -> Result<Vec<String>, String> {
    let url = api_url(&endpoint, "voices")?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .connect_timeout(Duration::from_secs(2))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Could not prepare the Kokoro connection.")?;
    let response = client.get(url).send().await.map_err(|_| "Cannot reach Kokoro at this address.")?;
    if !response.status().is_success() {
        return Err(format!("Kokoro answered HTTP {}.", response.status().as_u16()));
    }
    // A voice list is a few KB: never read more than 1 MB from whatever answers.
    let mut body = Vec::new();
    let mut response = response;
    while let Some(chunk) = response.chunk().await.map_err(|_| "The voice list download was interrupted.")? {
        if body.len() + chunk.len() > 1024 * 1024 {
            return Err("That server didn't send a Kokoro voice list.".into());
        }
        body.extend_from_slice(&chunk);
    }
    let json: serde_json::Value = serde_json::from_slice(&body).map_err(|_| "That server didn't send a Kokoro voice list.")?;
    let voices = parse_voices(&json);
    if voices.is_empty() {
        return Err("That server didn't send a Kokoro voice list.".into());
    }
    Ok(voices)
}

fn speech_url(endpoint: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(endpoint.trim()).map_err(|_| "Enter a valid Kokoro server URL in Settings.")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        return Err("Use HTTPS for a remote Kokoro server, or HTTP on localhost.".into());
    }
    if !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return Err("The Kokoro server URL must not contain credentials, a query or a fragment.".into());
    }
    url.set_path(&format!("{}/v1/audio/speech", url.path().trim_end_matches('/')));
    Ok(url)
}

#[tauri::command]
pub async fn kokoro_speech(endpoint: String, input: String, voice: String) -> Result<tauri::ipc::Response, String> {
    let url = speech_url(&endpoint)?;
    if input.trim().is_empty() || input.chars().count() > 1500 {
        return Err("Read aloud needs between 1 and 1500 characters per request.".into());
    }
    // Plain voice ids, or a mix such as "af_bella+af_sky" (Kokoro-FastAPI supports both).
    if voice.is_empty() || voice.len() > 80 || !voice.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '+') {
        return Err("Choose a valid Kokoro voice in Settings.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|_| "Could not prepare the Kokoro connection.")?;
    let mut response = client.post(url).json(&serde_json::json!({
        "model": "kokoro", "input": input, "voice": voice, "response_format": "wav", "speed": 1
    })).send().await.map_err(|_| "Cannot reach Kokoro. Start the server and check its address in Settings.")?;
    if !response.status().is_success() {
        return Err(format!("Kokoro returned HTTP {}. Check the server and selected voice in Settings.", response.status().as_u16()));
    }
    const LIMIT: usize = 20 * 1024 * 1024;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Kokoro audio download was interrupted.")? {
        if bytes.len() + chunk.len() > LIMIT { return Err("Kokoro returned too much audio for one passage.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.len() < 12 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err("Kokoro did not return WAV audio. Check that this is a compatible speech server.".into());
    }
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn voice_lists_in_the_shapes_kokoro_servers_use() {
        use serde_json::json;
        assert_eq!(parse_voices(&json!({"voices": ["bf_emma", "am_adam"]})), ["am_adam", "bf_emma"]);
        assert_eq!(parse_voices(&json!({"voices": [{"id": "af_heart"}, {"name": "bm_george"}]})), ["af_heart", "bm_george"]);
        assert_eq!(parse_voices(&json!(["bf_isabella"])), ["bf_isabella"]);
        assert!(parse_voices(&json!({"error": "x"})).is_empty());
        // Anything that isn't a plain voice id is dropped.
        assert_eq!(parse_voices(&json!({"voices": ["ok_voice", "../x", "a b"]})), ["ok_voice"]);
    }

    #[test]
    fn voices_url() {
        assert_eq!(api_url("http://127.0.0.1:8880", "voices").unwrap().as_str(), "http://127.0.0.1:8880/v1/audio/voices");
    }

    #[test]
    fn endpoint_rules() {
        assert_eq!(speech_url("http://127.0.0.1:8880/").unwrap().as_str(), "http://127.0.0.1:8880/v1/audio/speech");
        assert_eq!(speech_url("https://speech.example/kokoro").unwrap().path(), "/kokoro/v1/audio/speech");
        for bad in ["file:///secret", "http://public.example", "https://user:pass@example.com", "https://example.com/?token=x"] {
            assert!(speech_url(bad).is_err());
        }
    }
}
