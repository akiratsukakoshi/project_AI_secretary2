import supabase from '../config/supabase';

// 関数を1回だけ定義
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('count(*)');

    if (error) {
      console.error('Supabase接続エラー：', error);
      return;
    }

    console.log('接続成功:', data);
  } catch (error) {
    console.error('予期せぬエラー：', error);
  }
}

// 関数を1回だけ呼び出す
testConnection();
