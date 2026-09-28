from app.infrastructure.supabase_storage import SupabaseStorage


def test_secret_key_is_not_sent_as_bearer_token():
    storage = SupabaseStorage("https://project.supabase.co", "sb_secret_test", "paperflow")

    assert storage.headers == {"apikey": "sb_secret_test"}


def test_legacy_service_role_key_retains_bearer_token():
    storage = SupabaseStorage("https://project.supabase.co", "eyJ.legacy", "paperflow")

    assert storage.headers == {
        "apikey": "eyJ.legacy",
        "Authorization": "Bearer eyJ.legacy",
    }
