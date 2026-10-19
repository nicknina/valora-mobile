import { useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../services/supabaseClient';

export function useSupabaseUpload() {
  const [uploading, setUploading] = useState(false);

  async function upload(arquivo) {
    if (!supabase) {
      console.warn('Supabase não configurado: faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return null;
    }

    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(arquivo.uri, {
        encoding: 'base64',
      });

      const ext =
        arquivo.tipo === 'pdf'
          ? 'pdf'
          : (arquivo.uri.split('.').pop() ?? 'jpg');
      const nomeArquivo = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('notas-fiscais')
        .upload(nomeArquivo, decode(base64), {
          contentType: arquivo.mimeType,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Erro no upload:', err);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading };
}
