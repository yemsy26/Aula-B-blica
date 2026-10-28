package org.verbovivo.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // El plugin se registra antes de crear el Bridge para que el JS pueda
        // descubrirlo al arrancar. Si la biblioteca nativa no está en este ABI,
        // el plugin responde available=false y la app cae a wllama/WASM.
        registerPlugin(LlamaNativePlugin.class);
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        // El motor nativo ya no depende de COOP/COEP. Wllama queda como
        // respaldo para PC/web y ABIs sin biblioteca; en Android el WebView no
        // implementa cross-origin isolation y ese respaldo corre en un hilo.
    }
}
