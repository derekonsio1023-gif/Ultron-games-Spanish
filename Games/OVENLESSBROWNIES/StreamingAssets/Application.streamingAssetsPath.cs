using UnityEngine;
using UnityEngine.Video;
using System.IO;
using System.Collections;

[RequireComponent(typeof(VideoPlayer))]
public class WebGLVideoManager : MonoBehaviour
{
    private VideoPlayer videoPlayer;

    void Awake()
    {
        videoPlayer = GetComponent<VideoPlayer>();
        
        // Configuración obligatoria para WebGL
        videoPlayer.source = VideoSource.Url;
        videoPlayer.audioOutputMode = VideoAudioOutputMode.Direct;
        videoPlayer.playOnAwake = false;
        videoPlayer.isLooping = false;
    }

    /// <summary>
    /// Llama a esta función desde cualquier parte de tu código para reproducir un video.
    /// Ejemplo: ReproducirVideo("intro.webm");
    /// </summary>
    public void ReproducirVideo(string nombreArchivo)
    {
        // 1. Asegurarnos de que el archivo tiene extensión
        if (!nombreArchivo.Contains("."))
        {
            nombreArchivo += ".webm"; // Por defecto asumimos webm
        }

        // 2. Construir la ruta en StreamingAssets
        string ruta = Path.Combine(Application.streamingAssetsPath, nombreArchivo);
        
        // 3. Asignar la URL y preparar
        videoPlayer.url = ruta;
        
        // Evitar suscripciones múltiples
        videoPlayer.prepareCompleted -= OnVideoPreparado;
        videoPlayer.prepareCompleted += OnVideoPreparado;
        
        videoPlayer.Prepare();
    }

    private void OnVideoPreparado(VideoPlayer vp)
    {
        // El video está cargado en memoria. 
        // En WebGL, si esto no fue llamado por un clic del usuario, el navegador podría bloquearlo.
        videoPlayer.Play();
    }

    /// <summary>
    /// Función auxiliar para detener el video
    /// </summary>
    public void DetenerVideo()
    {
        videoPlayer.Stop();
    }
}