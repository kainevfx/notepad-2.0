//! Kokoro transport. Audio stays in memory; document text is never logged or stored here.
use std::time::Duration;

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
    if voice.is_empty() || voice.len() > 80 || !voice.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
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
    fn endpoint_rules() {
        assert_eq!(speech_url("http://127.0.0.1:8880/").unwrap().as_str(), "http://127.0.0.1:8880/v1/audio/speech");
        assert_eq!(speech_url("https://speech.example/kokoro").unwrap().path(), "/kokoro/v1/audio/speech");
        for bad in ["file:///secret", "http://public.example", "https://user:pass@example.com", "https://example.com/?token=x"] {
            assert!(speech_url(bad).is_err());
        }
    }
}
